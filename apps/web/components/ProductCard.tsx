"use client";

import { useState } from "react";
import type { Locale, ProductSummary } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";

export function ProductCard({ product, locale }: { product: ProductSummary; locale: Locale }) {
  const [imageFailed, setImageFailed] = useState(false);
  const dictionary = getDictionary(locale);
  const showImage = Boolean(product.imageUrl) && !imageFailed;

  return (
    <article className="shelf-card" data-testid="product-card">
      <a className="shelf-card__link" href={`/${locale}/products/${encodeURIComponent(product.barcode)}`}>
        <div className="shelf-card__image-wrap">
          {showImage ? (
            <img
              className="shelf-card__image"
              src={product.imageUrl ?? undefined}
              alt={product.name ?? dictionary.unavailable}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="shelf-card__placeholder" data-testid="product-image-placeholder" aria-hidden="true">
              <span>FF</span>
            </div>
          )}
        </div>
        <div className="shelf-card__body">
          <p className="shelf-card__eyebrow">{product.barcode}</p>
          <h3>{product.name ?? dictionary.unavailable}</h3>
          {product.usedLanguageFallback ? (
            <p className="fallback-note" title={dictionary.fallbackBody}>
              {dictionary.fallbackLabel}
              {product.displayLanguage && product.displayLanguage !== locale ? ` · ${product.displayLanguage.toUpperCase()}` : ""}
            </p>
          ) : null}
          <p className="shelf-card__brand">
            <span>{dictionary.brandLabel}</span> {product.brand ?? dictionary.unavailable}
          </p>
          <span className="shelf-card__action">{dictionary.viewProduct} →</span>
        </div>
      </a>
    </article>
  );
}
