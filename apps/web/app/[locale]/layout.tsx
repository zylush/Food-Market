import { notFound } from "next/navigation";
import type { Locale } from "@foodiesfeed/contracts";
import { isSupportedLocale, getDictionary } from "../../i18n/dictionaries";
import { SiteHeader } from "../../components/SiteHeader";

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dictionary = getDictionary(locale);
  return <div className="locale-shell" lang={locale}><SiteHeader locale={locale} />{children}<footer className="site-footer">{dictionary.footerNote}</footer></div>;
}
