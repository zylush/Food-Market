import type { Locale } from "@foodiesfeed/contracts";
import { LocaleSelector } from "./LocaleSelector";
import { getDictionary } from "../i18n/dictionaries";

export function SiteHeader({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  return (
    <header className="site-header">
      <a className="wordmark" href={`/${locale}`} aria-label={dictionary.brandName}>
        <span className="wordmark__mark" aria-hidden="true">ff</span>
        <span>{dictionary.brandName}</span>
      </a>
      <nav className="site-nav" aria-label={dictionary.navigationLabel}>
        <a href={`/${locale}#search-title`}>{dictionary.navSearch}</a>
        <a href={`/${locale}#how-it-works`}>{dictionary.navHowItWorks}</a>
        <a href={`/${locale}#premium`}>{dictionary.navPremium}</a>
      </nav>
      <LocaleSelector locale={locale} />
    </header>
  );
}
