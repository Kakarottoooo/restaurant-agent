"use client";

import { useState, useEffect, useCallback } from "react";
import { getT, type Translations } from "@/lib/i18n";

export interface LangOption {
  code: string;
  label: string;      // native name
  flag: string;
  labelEn: string;    // English name for aria/title
}

export const LANGUAGES: LangOption[] = [
  { code: "en",    label: "English",    flag: "🇺🇸", labelEn: "English" },
  { code: "zh-CN", label: "中文简体",   flag: "🇨🇳", labelEn: "Chinese (Simplified)" },
  { code: "zh-TW", label: "中文繁體",   flag: "🇹🇼", labelEn: "Chinese (Traditional)" },
  { code: "ja",    label: "日本語",     flag: "🇯🇵", labelEn: "Japanese" },
  { code: "ko",    label: "한국어",     flag: "🇰🇷", labelEn: "Korean" },
  { code: "es",    label: "Español",    flag: "🇪🇸", labelEn: "Spanish" },
  { code: "fr",    label: "Français",   flag: "🇫🇷", labelEn: "French" },
  { code: "de",    label: "Deutsch",    flag: "🇩🇪", labelEn: "German" },
];

const STORAGE_KEY = "onegent_language";

export function useLanguage() {
  const [lang, setLangState] = useState<string>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.find((l) => l.code === saved)) {
      setLangState(saved);
    } else {
      // Auto-detect from browser
      const browser = navigator.language ?? "en";
      const match = LANGUAGES.find((l) => browser.startsWith(l.code) || l.code.startsWith(browser.split("-")[0]));
      if (match) setLangState(match.code);
    }
  }, []);

  const setLang = useCallback((code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  /** A short instruction appended to the AI system prompt */
  const aiInstruction = lang === "en"
    ? ""
    : `IMPORTANT: Always respond in ${current.labelEn} (${current.label}). All recommendations, explanations, and messages must be written in ${current.label}.`;

  const t: Translations = getT(lang);

  return { lang, setLang, current, aiInstruction, t };
}
