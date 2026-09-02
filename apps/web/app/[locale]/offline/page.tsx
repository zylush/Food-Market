import type { Locale } from "@foodiesfeed/contracts";
import { notFound } from "next/navigation";
import { getDictionary, isSupportedLocale } from "../../../i18n/dictionaries";

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dictionary = getDictionary(locale);
  return <main className="page-width status-page"><p className="eyebrow eyebrow--green">FOODIESFEED / OFFLINE</p><h1>{dictionary.offlineTitle}</h1><p>{dictionary.offlineBody}</p><a className="button button--dark" href={`/${locale}`}>{dictionary.retry}</a></main>;
}
