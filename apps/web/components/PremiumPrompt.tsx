"use client";

import { useState } from "react";
import type { Locale } from "@foodiesfeed/contracts";
import { bootstrapSession, createCheckout } from "../features/api";
import { getDictionary } from "../i18n/dictionaries";

export type PremiumPromptVariant = "compact" | "featured";

const previewRows = [
  { key: "energyKj", value: 2100, unit: "kJ" },
  { key: "fatG", value: 28, unit: "g" },
  { key: "sugarsG", value: 44, unit: "g" },
  { key: "proteinG", value: 5.5, unit: "g" },
] as const;

const benefitKeys = ["premiumBenefitBasis", "premiumBenefitTable", "premiumBenefitSource"] as const;

export function PremiumPrompt({ locale, variant = "compact" }: { locale: Locale; variant?: PremiumPromptVariant }) {
  const dictionary = getDictionary(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  async function startCheckout(): Promise<void> {
    setLoading(true);
    setError(false);
    try {
      await bootstrapSession();
      const result = await createCheckout(locale);
      window.location.assign(result.url);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <aside className={`premium-prompt premium-prompt--${variant}`} aria-labelledby="premium-title">
      <div className="premium-prompt__intro">
        <p className="eyebrow">{dictionary.premiumEyebrow}</p>
        <h2 id="premium-title">{dictionary.premiumTitle}</h2>
        <p>{dictionary.premiumBody}</p>
      </div>

      {variant === "featured" ? (
        <div className="premium-prompt__detail">
          <div className="premium-preview__heading">
            <div>
              <p className="premium-preview__label">{dictionary.premiumPreviewLabel}</p>
              <span className="premium-preview__badge">{dictionary.premiumPreviewExample}</span>
            </div>
            <span className="premium-preview__basis">{dictionary.premiumPreviewBasis}</span>
          </div>
          <dl className="premium-preview" data-testid="premium-preview">
            {previewRows.map((row) => (
              <div key={row.key}>
                <dt>{dictionary[row.key]}</dt>
                <dd>
                  {numberFormatter.format(row.value)} <span>{row.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="premium-preview__note">{dictionary.premiumPreviewNote}</p>
          <ul className="premium-benefits">
            {benefitKeys.map((key) => <li key={key}>{dictionary[key]}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="premium-prompt__actions">
        <p className="premium-prompt__price">{dictionary.premiumPrice}</p>
        <button type="button" className="button button--dark" onClick={() => void startCheckout()} disabled={loading}>
          {loading ? dictionary.subscribing : dictionary.subscribe}
        </button>
        {error ? <p className="inline-error" role="alert">{dictionary.errorsCheckoutUnavailable}</p> : null}
      </div>
    </aside>
  );
}
