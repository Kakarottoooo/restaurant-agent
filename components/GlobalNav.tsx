"use client";

/**
 * GlobalNav — shared top navigation bar
 *
 * Used on: /trips, /monitoring, /insights, /metrics
 * NOT on: / (home) — home has its own inline nav
 */

import { useState, useEffect } from "react";
import { useLanguage, LANGUAGES } from "@/app/hooks/useLanguage";

type Page = "trips" | "monitoring" | "insights" | "metrics" | "other";

interface Props {
  active?: Page;
}

function getSessionId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("session_id") ?? "";
}

export default function GlobalNav({ active }: Props) {
  const [actionCount, setActionCount] = useState(0);
  const [monitorCount, setMonitorCount] = useState(0);
  const { lang, setLang, current: currentLang, t } = useLanguage();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  useEffect(() => {
    const sid = getSessionId();
    if (!sid) return;

    // Fetch action-needed count for badge
    fetch(`/api/booking-jobs?session_id=${encodeURIComponent(sid)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.jobs) return;
        const actions = d.jobs.reduce((n: number, j: { steps?: { actionItem?: unknown }[] }) =>
          n + (j.steps?.filter((s) => s.actionItem).length ?? 0), 0);
        setActionCount(actions);
      })
      .catch(() => {});

    // Fetch active monitor count
    fetch(`/api/monitors?session_id=${encodeURIComponent(sid)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.monitors) return;
        setMonitorCount(d.monitors.filter((m: { status: string }) => m.status === "active").length);
      })
      .catch(() => {});
  }, []);

  const links: { href: string; label: string; id: Page; badge?: number }[] = [
    { href: "/trips",      label: t.nav.myTrips,    id: "trips",      badge: actionCount || undefined },
    { href: "/monitoring", label: t.nav.monitoring,  id: "monitoring", badge: monitorCount || undefined },
    { href: "/insights",   label: t.nav.insights,    id: "insights" },
  ];

  return (
    <nav style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      backgroundColor: "var(--bg, #fafaf9)",
      borderBottom: "0.5px solid var(--border, #e5e7eb)",
      padding: "0 20px",
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      {/* Logo */}
      <a
        href="/"
        style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--text-primary, #111)",
          textDecoration: "none",
          letterSpacing: "-0.01em",
          flexShrink: 0,
        }}
      >
        Onegent<span style={{ color: "var(--gold, #C9A84C)" }}>.</span>
      </a>

      {/* Links + Language picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {links.map((link) => {
          const isActive = active === link.id;
          return (
            <a
              key={link.id}
              href={link.href}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text-primary, #111)" : "var(--text-secondary, #666)",
                textDecoration: "none",
                backgroundColor: isActive ? "var(--card, #f5f5f4)" : "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {link.label}
              {link.badge != null && link.badge > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  backgroundColor: link.id === "monitoring" ? "var(--gold, #C9A84C)" : "rgba(220,38,38,0.85)",
                  borderRadius: 20,
                  padding: "1px 5px",
                  lineHeight: 1.5,
                }}>
                  {link.badge}
                </span>
              )}
            </a>
          );
        })}

        {/* Settings link */}
        <a
          href="/permissions"
          title={t.nav.permissions}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8, marginLeft: 4,
            border: active === "other" ? "1px solid var(--gold, #C9A84C)" : "0.5px solid var(--border, #e5e7eb)",
            color: active === "other" ? "var(--gold, #C9A84C)" : "var(--text-secondary, #666)",
            textDecoration: "none", fontSize: 15,
            backgroundColor: active === "other" ? "rgba(201,168,76,0.07)" : "transparent",
          }}
        >
          ⚙
        </a>

        {/* Language picker */}
        <div style={{ position: "relative", marginLeft: 4 }}>
          <button
            onClick={() => setLangMenuOpen((o) => !o)}
            title="Language"
            style={{
              background: "none", border: "0.5px solid var(--border, #e5e7eb)",
              borderRadius: 8, padding: "5px 8px", cursor: "pointer",
              fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center",
            }}
          >
            {currentLang.flag}
          </button>
          {langMenuOpen && (
            <>
              {/* Backdrop to close */}
              <div
                onClick={() => setLangMenuOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 49 }}
              />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                backgroundColor: "var(--bg, #fafaf9)", border: "0.5px solid var(--border, #e5e7eb)",
                borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: 190, zIndex: 50, overflow: "hidden",
              }}>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", textAlign: "left", padding: "8px 14px",
                      fontFamily: "var(--font-dm-sans)", fontSize: "13px",
                      color: l.code === lang ? "var(--gold, #C9A84C)" : "var(--text-primary, #111)",
                      fontWeight: l.code === lang ? 600 : 400,
                      background: l.code === lang ? "rgba(201,168,76,0.07)" : "none",
                      border: "none", borderBottom: "0.5px solid var(--border, #e5e7eb)", cursor: "pointer",
                    }}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {l.code === lang && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
