import type { Locale } from "@foodiesfeed/contracts";
import { notFound } from "next/navigation";
import { FoodiesFeedHome } from "../../components/FoodiesFeedHome";
import { isSupportedLocale } from "../../i18n/dictionaries";

export default async function LocaleHome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[]; recent?: string | string[] }> }) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const queryParams = await searchParams;
  const initialQuery = typeof queryParams.q === "string"
    ? queryParams.q
    : typeof queryParams.recent === "string"
      ? queryParams.recent
      : "";
  return <FoodiesFeedHome locale={rawLocale as Locale} initialQuery={initialQuery} />;
}
