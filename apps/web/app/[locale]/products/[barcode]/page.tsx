import type { Locale } from "@foodiesfeed/contracts";
import { notFound } from "next/navigation";
import { ProductView } from "../../../../components/ProductView";
import { isSupportedLocale } from "../../../../i18n/dictionaries";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; barcode: string }> }) {
  const { locale: rawLocale, barcode } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  return <ProductView locale={rawLocale as Locale} barcode={barcode} />;
}
