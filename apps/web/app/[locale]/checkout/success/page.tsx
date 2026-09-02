import type { Locale } from "@foodiesfeed/contracts";
import { notFound } from "next/navigation";
import { CheckoutProcessing } from "../../../../components/CheckoutProcessing";
import { isSupportedLocale } from "../../../../i18n/dictionaries";

export default async function CheckoutSuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  return <CheckoutProcessing locale={rawLocale as Locale} />;
}
