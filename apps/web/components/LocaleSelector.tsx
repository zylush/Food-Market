"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";

const localeLabels: Record<Locale, keyof ReturnType<typeof getDictionary>> = {
  en: "localeEn",
  nl: "localeNl",
  de: "localeDe",
  fr: "localeFr",
};

export function LocaleSelector({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const dictionary = getDictionary(locale);

  function changeLocale(nextLocale: Locale): void {
    document.cookie = `foodiesfeed_locale=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
    window.localStorage.setItem("foodiesfeed_locale", nextLocale);
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    router.push(segments.join("/") || `/${nextLocale}`);
  }

  return (
    <label className="locale-picker">
      <span>{dictionary.languageLabel}</span>
      <select
        aria-label={dictionary.languageLabel}
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
      >
        {(Object.keys(localeLabels) as Locale[]).map((option) => (
          <option key={option} value={option}>
            {getDictionary(locale)[localeLabels[option]]}
          </option>
        ))}
      </select>
    </label>
  );
}
