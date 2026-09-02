"use client";

import { useEffect, useState } from "react";
import type { Locale, ProductSummary, RecentSearch } from "@foodiesfeed/contracts";
import { ProductCard } from "./ProductCard";
import { PremiumPrompt } from "./PremiumPrompt";
import { ApiClientError, bootstrapSession, fetchRecentSearches, searchProducts } from "../features/api";
import { validateSearchInput } from "../features/search-validation";
import { getDictionary, translate } from "../i18n/dictionaries";

function errorMessage(locale: Locale, error: unknown): string {
  const dictionary = getDictionary(locale);
  if (!(error instanceof ApiClientError)) return dictionary.errorsInternal;
  const keyByCode: Record<string, keyof typeof dictionary> = {
    INVALID_REQUEST: "errorsInvalidRequest",
    UPSTREAM_RATE_LIMITED: "errorsUpstreamRateLimited",
    UPSTREAM_UNAVAILABLE: "errorsUpstreamUnavailable",
    NOT_FOUND: "errorsNotFound",
  };
  return dictionary[keyByCode[error.code] ?? "errorsInternal"];
}

export function FoodiesFeedHome({ locale, initialQuery = "" }: { locale: Locale; initialQuery?: string }) {
  const dictionary = getDictionary(locale);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState(false);

  useEffect(() => {
    let mounted = true;
    void bootstrapSession()
      .then(() => fetchRecentSearches())
      .then((items) => {
        if (mounted) setRecent(items);
      })
      .catch(() => {
        if (mounted) setSessionNotice(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialQuery) return;
    const validation = validateSearchInput(initialQuery);
    if (validation.valid) void executeSearch(validation.query);
    // The query comes from an explicit recent-search link, not from keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  async function executeSearch(nextQuery: string): Promise<void> {
    setLoading(true);
    setRequestError(null);
    setSubmittedQuery(nextQuery);
    try {
      const products = await searchProducts(nextQuery, locale);
      setResults(products);
      void fetchRecentSearches().then(setRecent).catch(() => undefined);
    } catch (error) {
      setResults([]);
      setRequestError(errorMessage(locale, error));
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const validation = validateSearchInput(query);
    if (!validation.valid) {
      setValidationError(true);
      setRequestError(null);
      return;
    }
    setValidationError(false);
    void executeSearch(validation.query);
  }

  function selectRecent(item: RecentSearch): void {
    setQuery(item.displayTerm);
    if (item.locale !== locale) {
      document.cookie = `foodiesfeed_locale=${item.locale}; Max-Age=31536000; Path=/; SameSite=Lax`;
      window.location.assign(`/${item.locale}?recent=${encodeURIComponent(item.displayTerm)}`);
      return;
    }
    void executeSearch(item.displayTerm);
  }

  return (
    <main>
      <section className="hero page-width">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--green">{dictionary.heroEyebrow}</p>
          <h1>{dictionary.heroTitle}</h1>
          <p className="hero__body">{dictionary.heroBody}</p>
        </div>
        <div className="hero__stamp" aria-label="FoodiesFeed product search">
          <span>FF</span>
          <small>FIELD<br />NOTES</small>
        </div>
      </section>

      <section className="search-panel page-width" aria-labelledby="search-title">
        <div className="search-panel__topline">
          <span className="section-number">01</span>
          <span>{dictionary.searchLabel}</span>
        </div>
        <h2 id="search-title">{dictionary.searchLabel}</h2>
        <form className="search-form" onSubmit={submitSearch} noValidate>
          <label htmlFor="product-search">{dictionary.searchLabel}</label>
          <div className="search-form__row">
            <input
              id="product-search"
              data-testid="search-input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (validationError) setValidationError(false);
              }}
              placeholder={dictionary.searchPlaceholder}
              aria-invalid={validationError}
              aria-describedby={validationError ? "search-hint search-error" : "search-hint"}
            />
            <button className="button button--tomato" type="submit" disabled={loading}>
              {loading ? dictionary.searching : dictionary.searchButton}
            </button>
          </div>
          <p id="search-hint" className="form-hint">{dictionary.searchHint}</p>
          {validationError ? <p id="search-error" className="inline-error" role="alert">{dictionary.invalidQuery}</p> : null}
        </form>
      </section>

      <div className="page-width content-grid">
        <section className="results-section" aria-labelledby="results-title" aria-busy={loading}>
          <div className="section-heading section-heading--lined">
            <div>
              <p className="eyebrow">{submittedQuery ? `QUERY / ${submittedQuery}` : "02 / DISCOVER"}</p>
              <h2 id="results-title">{dictionary.resultsHeading}</h2>
            </div>
            {submittedQuery && !loading ? <span className="result-count">{translate(locale, "resultCount", { count: results.length })}</span> : null}
          </div>
          <div aria-live="polite" className="sr-only">{loading ? dictionary.searching : ""}</div>
          {requestError ? <div className="state-panel state-panel--error" role="alert"><p>{requestError}</p><button className="text-button" type="button" onClick={() => void executeSearch(submittedQuery)}>{dictionary.retry}</button></div> : null}
          {!loading && !requestError && submittedQuery && results.length === 0 ? (
            <div className="state-panel" data-testid="no-results"><h3>{dictionary.noResultsTitle}</h3><p>{dictionary.noResultsBody}</p></div>
          ) : null}
          <div className="product-grid">
            {results.map((product) => <ProductCard key={product.barcode} product={product} locale={locale} />)}
          </div>
        </section>

        <aside className="sidebar">
          <section className="recent-section" aria-labelledby="recent-title">
            <div className="section-heading section-heading--small"><p className="eyebrow">03 / MEMORY</p><h2 id="recent-title">{dictionary.recentTitle}</h2></div>
            {sessionNotice ? <p className="muted-copy">{dictionary.sessionUnavailable}</p> : null}
            {!sessionNotice && recent.length === 0 ? <p className="muted-copy">{dictionary.recentEmpty}</p> : null}
            {recent.length > 0 ? <ul className="recent-list">{recent.slice(0, 10).map((item) => <li key={item.id}><button type="button" onClick={() => selectRecent(item)}><span>{item.displayTerm}</span><small>{item.locale.toUpperCase()}</small></button></li>)}</ul> : null}
          </section>
          <PremiumPrompt locale={locale} />
        </aside>
      </div>
    </main>
  );
}
