/**
 * Laptop Watch — automated new-product detection
 *
 * Runs daily via Vercel Cron. For each mainstream laptop brand, searches
 * Tavily for recent announcements, uses MiniMax to extract structured info,
 * and writes new finds to data/pending_devices.json.
 *
 * No external notifications. The pipeline reads pending_devices.json at
 * query time so it can give users accurate "announced but not yet reviewed"
 * messages instead of generic "not in our database" warnings.
 *
 * Env vars required:
 *   MINIMAX_API_KEY   — already used by the chat pipeline
 *   TAVILY_API_KEY    — already used by the chat pipeline
 *   CRON_SECRET       — shared secret checked by the API route
 */

import fs from "fs";
import path from "path";
import { DetectedProduct, PendingProductsFile } from "./watchTypes";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const laptopsData = require("../data/laptops.json");

// Re-export for backward compat with laptopEngine.ts
export type { DetectedProduct as DetectedDevice };
export type { PendingProductsFile as PendingDevicesFile };

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface ExtractedInfo {
  is_new_laptop: boolean;
  name: string;
  brand: string;
  cpu?: string;
  price_usd?: number;
  display_size?: number;
  weight_kg?: number;
  ram_gb?: number;
  storage_gb?: number;
}

// ─── Brand search config ──────────────────────────────────────────────────────

const WATCH_BRANDS = [
  { name: "Apple",     query: "Apple MacBook new model announced 2025 2026" },
  { name: "Lenovo",    query: "Lenovo ThinkPad IdeaPad Legion Yoga new laptop announced 2025 2026" },
  { name: "Dell",      query: "Dell XPS Inspiron Latitude new laptop announced 2025 2026" },
  { name: "HP",        query: "HP Spectre EliteBook Envy Omen new laptop announced 2025 2026" },
  { name: "ASUS",      query: "ASUS ZenBook VivoBook ROG ProArt Studiobook new laptop announced 2025 2026" },
  { name: "Microsoft", query: "Microsoft Surface Laptop new model announced 2025 2026" },
  { name: "Samsung",   query: "Samsung Galaxy Book new laptop announced 2025 2026" },
  { name: "LG",        query: "LG Gram new laptop announced 2025 2026" },
  { name: "Framework", query: "Framework Laptop new model announced 2025 2026" },
  { name: "Razer",     query: "Razer Blade new laptop announced 2025 2026" },
  { name: "Acer",      query: "Acer Swift Aspire Nitro Predator new laptop announced 2025 2026" },
  { name: "MSI",       query: "MSI new laptop announced 2025 2026" },
  { name: "Huawei",    query: "Huawei MateBook new laptop announced 2025 2026" },
];

// ─── File I/O ─────────────────────────────────────────────────────────────────

const PENDING_PATH = path.join(process.cwd(), "data", "pending_devices.json");

export function readPendingDevices(): PendingProductsFile {
  try {
    return JSON.parse(fs.readFileSync(PENDING_PATH, "utf-8")) as PendingProductsFile;
  } catch {
    return { last_checked: "", pending: [] };
  }
}

function writePendingDevices(data: PendingProductsFile): void {
  try {
    fs.writeFileSync(PENDING_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Vercel serverless filesystem is read-only — best-effort only.
    console.warn("[laptop-watch] Could not write pending_devices.json (read-only fs)");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function minimaxExtract(system: string, userContent: string): Promise<string> {
  const res = await fetch("https://api.minimaxi.chat/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: "MiniMax-Text-01",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`MiniMax error: ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []) as TavilyResult[];
}

async function extractInfo(result: TavilyResult): Promise<ExtractedInfo | null> {
  const raw = await minimaxExtract(
    `You detect new laptop product announcements from tech news.
Return ONLY a valid JSON object with these fields:
{
  "is_new_laptop": false,
  "name": "",
  "brand": "",
  "cpu": null,
  "price_usd": null,
  "display_size": null,
  "weight_kg": null,
  "ram_gb": null,
  "storage_gb": null
}

Rules:
- is_new_laptop: true only if this announces a brand-new laptop model (not a software update, comparison article, or review of an existing device)
- name: precise model name e.g. "MacBook Pro 14\\" (M5 Pro)" or "ThinkPad X1 Carbon Gen 13"
- Extract numeric values only when clearly stated; use null otherwise
- brand: official brand name (Apple / Lenovo / Dell / HP / ASUS / Microsoft / Samsung / LG / Framework / Razer / Acer / MSI / Huawei)`,
    `Title: ${result.title}\n\nSnippet: ${result.content.slice(0, 1200)}`
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as ExtractedInfo;
  } catch {
    return null;
  }
}

function loadExistingNames(): Set<string> {
  const devices = (laptopsData as { devices: { name: string }[] }).devices;
  return new Set(devices.map((d) => d.name.toLowerCase()));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runLaptopWatch(): Promise<{
  checked: number;
  new_devices: number;
  new_names: string[];
  errors: string[];
}> {
  const existingNames = loadExistingNames();
  const pendingFile = readPendingDevices();
  const alreadyPendingNames = new Set(
    pendingFile.pending.map((d) => d.name.toLowerCase())
  );

  const newDevices: DetectedProduct[] = [];
  const errors: string[] = [];
  let checked = 0;

  for (const brand of WATCH_BRANDS) {
    try {
      const results = await tavilySearch(brand.query);

      for (const result of results) {
        checked++;
        let info: ExtractedInfo | null = null;
        try {
          info = await extractInfo(result);
        } catch (err) {
          errors.push(`extract(${brand.name}): ${String(err)}`);
          continue;
        }

        if (!info?.is_new_laptop || !info.name.trim()) continue;

        const nameLower = info.name.toLowerCase();
        if (existingNames.has(nameLower) || alreadyPendingNames.has(nameLower)) continue;

        const device: DetectedProduct = {
          id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          watch_category: "laptop",
          detected_at: new Date().toISOString(),
          name: info.name,
          brand: info.brand || brand.name,
          source_url: result.url,
          source_title: result.title,
          raw_excerpt: result.content.slice(0, 500),
          extracted_specs: {
            ...(info.cpu ? { cpu: info.cpu } : {}),
            ...(info.price_usd ? { price_usd: info.price_usd } : {}),
            ...(info.display_size ? { display_size: info.display_size } : {}),
            ...(info.weight_kg ? { weight_kg: info.weight_kg } : {}),
            ...(info.ram_gb ? { ram_gb: info.ram_gb } : {}),
            ...(info.storage_gb ? { storage_gb: info.storage_gb } : {}),
          },
          status: "pending_review",
        };

        newDevices.push(device);
        alreadyPendingNames.add(nameLower);
      }
    } catch (err) {
      errors.push(`search(${brand.name}): ${String(err)}`);
    }
  }

  pendingFile.last_checked = new Date().toISOString();
  if (newDevices.length > 0) {
    pendingFile.pending.push(...newDevices);
  }
  writePendingDevices(pendingFile);

  return {
    checked,
    new_devices: newDevices.length,
    new_names: newDevices.map((d) => d.name),
    errors,
  };
}
