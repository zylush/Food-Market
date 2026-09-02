import type { Locale } from "@foodiesfeed/contracts";
import { notFound } from "next/navigation";
import { getDictionary, isSupportedLocale } from "../../../../i18n/dictionaries";

export default async function CheckoutCancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dictionary = getDictionary(locale);
  return <main className="page-width status-page"><p className="eyebrow">CHECKOUT / CANCELLED</p><h1>{dictionary.checkoutCancelledTitle}</h1><p>{dictionary.checkoutCancelledBody}</p><a className="button button--dark" href={`/${locale}`}>{dictionary.returnToSearch}</a></main>;
}
