"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Locale } from "@/i18n.config";

interface UseTranslateContentOptions<T> {
  content: T | null;
  cacheKey: string;
  enabled?: boolean;
}

interface UseTranslateContentResult<T> {
  translated: T | null;
  translating: boolean;
  locale: Locale;
}

function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem("locale") as Locale) || "en";
}

const translationCache = new Map<string, unknown>();

async function translateViaApi<T>(content: T, targetLocale: Locale): Promise<T> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, targetLocale }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Translation failed.");
  return data.data as T;
}

export function useTranslateContent<T>({
  content,
  cacheKey,
  enabled = true,
}: UseTranslateContentOptions<T>): UseTranslateContentResult<T> {
  const [locale, setLocale] = useState<Locale>(getLocale);
  const [translated, setTranslated] = useState<T | null>(null);
  const [translating, setTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setLocale((e as CustomEvent<Locale>).detail);
    };
    window.addEventListener("localeChange", handler);
    return () => window.removeEventListener("localeChange", handler);
  }, []);

  const doTranslate = useCallback(
    async (src: T, loc: Locale) => {
      if (loc === "en") {
        setTranslated(null);
        return;
      }

      const key = `${cacheKey}__${loc}`;
      const cached = translationCache.get(key) as T | undefined;
      if (cached) {
        setTranslated(cached);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setTranslating(true);
      try {
        const result = await translateViaApi(src, loc);
        if (!controller.signal.aborted) {
          setTranslated(result);
          translationCache.set(key, result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setTranslated(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setTranslating(false);
        }
      }
    },
    [cacheKey],
  );

  useEffect(() => {
    if (!enabled || !content) {
      setTranslated(null);
      return;
    }
    doTranslate(content, locale);
  }, [content, locale, enabled, doTranslate]);

  return {
    translated,
    translating,
    locale,
  };
}
