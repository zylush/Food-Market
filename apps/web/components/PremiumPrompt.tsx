"use client";

import { useState } from "react";
import type { Locale } from "@foodiesfeed/contracts";
import { createCheckout } from "../features/api";
import { getDictionary } from "../i18n/dictionaries";

export function PremiumPrompt({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function startCheckout(): Promise<void> {
    setLoading(true);
    setError(false);
    try {
      const result = await createCheckout(locale);
      window.location.assign(result.url);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <aside className="premium-prompt" aria-labelledby="premium-title">
      <p className="eyebrow">{dictionary.premiumEyebrow}</p>
      <h2 id="premium-title">{dictionary.premiumTitle}</h2>
      <p>{dictionary.premiumBody}</p>
      <p className="premium-prompt__price">{dictionary.premiumPrice}</p>
      <button type="button" className="button button--dark" onClick={() => void startCheckout()} disabled={loading}>
        {loading ? dictionary.subscribing : dictionary.subscribe}
      </button>
      {error ? <p className="inline-error" role="alert">{dictionary.errorsCheckoutUnavailable}</p> : null}
    </aside>
  );
}
