"use client";

import { useEffect, useState } from "react";
import type { Locale, NutritionDetails, ProductSummary } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";
import { ApiClientError, bootstrapSession, fetchNutrition, fetchPublicProduct } from "../features/api";
import { NutritionTable } from "./NutritionTable";
import { PremiumPrompt } from "./PremiumPrompt";

function ProductImage({ product, locale }: { product: ProductSummary; locale: Locale }) {
  const [failed, setFailed] = useState(false);
  const dictionary = getDictionary(locale);
  if (!product.imageUrl || failed) {
    return <div className="product-hero__placeholder" data-testid="product-image-placeholder" aria-label={dictionary.unavailable}><span>FF</span></div>;
  }
  return <img className="product-hero__image" src={product.imageUrl} alt={product.name ?? dictionary.unavailable} onError={() => setFailed(true)} />;
}

export function ProductView({ locale, barcode }: { locale: Locale; barcode: string }) {
  const dictionary = getDictionary(locale);
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [nutrition, setNutrition] = useState<NutritionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nutritionError, setNutritionError] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load(): Promise<void> {
      try {
        const publicProduct = await fetchPublicProduct(barcode, locale);
        if (!mounted) return;
        setProduct(publicProduct);
        try {
          await bootstrapSession();
        } catch {
          if (mounted) setSessionWarning(true);
          return;
        }
        try {
          const details = await fetchNutrition(barcode);
          if (mounted) setNutrition(details);
        } catch (caught) {
          if (caught instanceof ApiClientError && caught.code !== "SUBSCRIPTION_REQUIRED" && caught.code !== "INVALID_SESSION") {
            setNutritionError(dictionary.errorsUpstreamUnavailable);
          }
          if (caught instanceof ApiClientError && caught.code === "INVALID_SESSION") setSessionWarning(true);
        }
      } catch (caught) {
        if (mounted) setError(caught instanceof ApiClientError && caught.code === "NOT_FOUND" ? dictionary.productNotFound : dictionary.productError);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [barcode, dictionary.errorsUpstreamUnavailable, dictionary.productError, dictionary.productNotFound, locale]);

  return (
    <main id="main-content" className="page-width product-page">
      <a className="back-link" href={`/${locale}`}>← {dictionary.backToSearch}</a>
      {loading ? <div className="state-panel" role="status">{dictionary.productLoading}</div> : null}
      {error ? <div className="state-panel state-panel--error" role="alert"><p>{error}</p><a className="text-button" href={`/${locale}`}>{dictionary.backToSearch}</a></div> : null}
      {product && !error ? (
        <>
          <section className="product-hero">
            <div className="product-hero__visual"><ProductImage product={product} locale={locale} /></div>
            <div className="product-hero__content">
              <p className="eyebrow eyebrow--green">PRODUCT / {product.barcode}</p>
              <h1>{product.name ?? dictionary.unavailable}</h1>
              {product.usedLanguageFallback ? <p className="fallback-note">{dictionary.fallbackLabel}{product.displayLanguage ? ` · ${product.displayLanguage.toUpperCase()}` : ""}</p> : null}
              <dl className="product-facts"><div><dt>{dictionary.brandLabel}</dt><dd>{product.brand ?? dictionary.unavailable}</dd></div><div><dt>{dictionary.barcodeLabel}</dt><dd className="mono">{product.barcode}</dd></div></dl>
              <a className="source-link" href={product.sourceUrl} target="_blank" rel="noreferrer">{dictionary.sourceLinkLabel} ↗</a>
            </div>
          </section>
          <section className="product-nutrition">
            {nutrition ? <NutritionTable locale={locale} nutrition={nutrition} /> : <PremiumPrompt locale={locale} />}
            {nutritionError ? <p className="state-panel state-panel--error" role="alert">{nutritionError}</p> : null}
            {sessionWarning ? <p className="muted-copy">{dictionary.sessionUnavailable}</p> : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
