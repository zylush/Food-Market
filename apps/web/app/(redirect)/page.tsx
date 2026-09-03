import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupportedLocale } from "../../i18n/dictionaries";

export default async function RootPage() {
  const cookieStore = await cookies();
  const stored = cookieStore.get("foodiesfeed_locale")?.value;
  redirect(`/${stored && isSupportedLocale(stored) ? stored : "en"}`);
}
