"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale, ProductSummary, RecentSearch } from "@foodiesfeed/contracts";
import { LandingStory } from "./LandingStory";
import { ProductCard } from "./ProductCard";
import { PremiumPrompt } from "./PremiumPrompt";
import { RecentSearches } from "./RecentSearches";
import { ApiClientError, bootstrapSession, fetchRecentSearches, searchProducts } from "../features/api";
import { validateSearchInput } from "../features/search-validation";
import { getDictionary, translate } from "../i18n/dictionaries";

function errorMessage(locale: Locale, error: unknown): string {
  const dictionary = getDictionary(locale);
  if (!(error instanceof ApiClientError)) return dictionary.errorsInternal;
  const keyByCode: Record<string, keyof typeof dictionary> = {
    INVALID_REQUEST: "errorsInvalidRequest",
    UPSTREAM_RATE_LIMITED: "errorsUpstreamRateLimited",
    UPSTREAM_TIMEOUT: "errorsUpstreamTimeout",
    UPSTREAM_UNAVAILABLE: "errorsUpstreamUnavailable",
    UPSTREAM_MALFORMED: "errorsUpstreamUnavailable",
    NETWORK_UNAVAILABLE: "errorsNetworkUnavailable",
    NOT_FOUND: "errorsNotFound",
  };
  return dictionary[keyByCode[error.code] ?? "errorsInternal"];
}

interface SearchRequestError {
  message: string;
  retryUntil: number | null;
}

export function FoodiesFeedHome({ locale, initialQuery = "" }: { locale: Locale; initialQuery?: string }) {
  const dictionary = getDictionary(locale);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exampleQueries = [dictionary.searchExampleOne, dictionary.searchExampleTwo, dictionary.searchExampleThree];
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const [requestError, setRequestError] = useState<SearchRequestError | null>(null);
  const [retryClock, setRetryClock] = useState(() => Date.now());
  const [sessionNotice, setSessionNotice] = useState(false);

  const retryRemainingSeconds = requestError?.retryUntil === null || requestError?.retryUntil === undefined
    ? 0
    : Math.max(0, Math.ceil((requestError.retryUntil - retryClock) / 1_000));

  useEffect(() => {
    const retryUntil = requestError?.retryUntil;
    if (!retryUntil || retryUntil <= Date.now()) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setRetryClock(now);
      if (now >= retryUntil) window.clearInterval(interval);
    }, 250);
    return () => window.clearInterval(interval);
  }, [requestError?.retryUntil]);

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
    setRetryClock(Date.now());
    setSubmittedQuery(nextQuery);
    try {
      const products = await searchProducts(nextQuery, locale);
      setResults(products);
      void fetchRecentSearches().then(setRecent).catch(() => undefined);
    } catch (error) {
      setResults([]);
      const retryAfterSeconds = error instanceof ApiClientError && error.code === "UPSTREAM_RATE_LIMITED"
        ? error.retryAfterSeconds
        : null;
      setRequestError({
        message: errorMessage(locale, error),
        retryUntil: retryAfterSeconds && retryAfterSeconds > 0 ? Date.now() + retryAfterSeconds * 1_000 : null,
      });
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

  function chooseExample(example: string): void {
    setQuery(example);
    setValidationError(false);
    searchInputRef.current?.focus();
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
    <main id="main-content" className="home-main">
      <section className="hero page-width">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--green">{dictionary.heroEyebrow}</p>
          <h1>{dictionary.heroTitle}</h1>
          <p className="hero__body">{dictionary.heroBody}</p>
        </div>
        <div className="hero__specimen" aria-label={dictionary.heroSpecimenLabel}>
          <div className="hero__specimen-top">
            <span>{dictionary.brandName}</span>
            <span className="hero__specimen-seal" aria-hidden="true">ff</span>
          </div>
          <p className="hero__specimen-title">{dictionary.heroSpecimenLabel}</p>
          <div className="hero__specimen-rule" aria-hidden="true" />
          <dl className="hero__specimen-facts">
            <div>
              <dt>{dictionary.heroSpecimenFreeLabel}</dt>
              <dd>{dictionary.heroSpecimenFreeValue}</dd>
            </div>
            <div>
              <dt>{dictionary.heroSpecimenPremiumLabel}</dt>
              <dd>{dictionary.heroSpecimenPremiumValue}</dd>
            </div>
          </dl>
          <span className="hero__specimen-code" aria-hidden="true">000 / 100 / FF</span>
        </div>
      </section>

      <section className="search-panel page-width" aria-labelledby="search-title">
        <div className="search-panel__topline">
          <span className="section-number">01</span>
          <span>{dictionary.searchSectionEyebrow}</span>
        </div>
        <h2 id="search-title">{dictionary.searchLabel}</h2>
        <form className="search-form" onSubmit={submitSearch} noValidate>
          <label className="search-form__label" htmlFor="product-search">{dictionary.searchLabel}</label>
          <div className="search-form__row">
            <input
              id="product-search"
              data-testid="search-input"
              ref={searchInputRef}
              type="search"
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
        <div className="search-examples" role="group" aria-label={dictionary.searchExamplesLabel}>
          <span className="search-examples__label">{dictionary.searchExamplesLabel}</span>
          {exampleQueries.map((example) => (
            <button key={example} className="query-chip" type="button" onClick={() => chooseExample(example)} disabled={loading}>
              {example}
            </button>
          ))}
        </div>
      </section>

      <div className={`page-width content-grid ${submittedQuery ? "content-grid--results" : "content-grid--landing"}`}>
        {submittedQuery ? (
          <section className="results-section" aria-labelledby="results-title" aria-busy={loading}>
            <div className="section-heading section-heading--lined">
              <div>
                <p className="eyebrow">{translate(locale, "queryEyebrow", { query: submittedQuery })}</p>
                <h2 id="results-title">{dictionary.resultsHeading}</h2>
              </div>
              {!loading ? <span className="result-count">{translate(locale, "resultCount", { count: results.length })}</span> : null}
            </div>
            <div aria-live="polite" className="sr-only">{loading ? dictionary.searching : ""}</div>
            {requestError ? <div className="state-panel state-panel--error" role="alert"><p>{requestError.message}</p><button className="text-button" type="button" onClick={() => void executeSearch(submittedQuery)} disabled={retryRemainingSeconds > 0}>{retryRemainingSeconds > 0 ? translate(locale, "retryAfter", { seconds: retryRemainingSeconds }) : dictionary.retry}</button></div> : null}
            {!loading && !requestError && results.length === 0 ? (
              <div className="state-panel" data-testid="no-results"><h3>{dictionary.noResultsTitle}</h3><p>{dictionary.noResultsBody}</p></div>
            ) : null}
            {loading ? (
              <div className="product-grid product-grid--loading" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="shelf-card shelf-card--skeleton" data-testid="result-skeleton" key={`skeleton-${index}`}>
                    <div className="shelf-card__image-wrap"><span className="skeleton-block skeleton-block--image" /></div>
                    <div className="shelf-card__body">
                      <span className="skeleton-block skeleton-block--short" />
                      <span className="skeleton-block skeleton-block--title" />
                      <span className="skeleton-block skeleton-block--line" />
                      <span className="skeleton-block skeleton-block--action" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="product-grid">
                {results.map((product) => <ProductCard key={product.barcode} product={product} locale={locale} />)}
              </div>
            )}
          </section>
        ) : <LandingStory locale={locale} />}

        <aside className="sidebar">
          <RecentSearches locale={locale} recent={recent} sessionNotice={sessionNotice} onSelect={selectRecent} />
          {submittedQuery ? <div id="premium"><PremiumPrompt locale={locale} /></div> : null}
        </aside>
      </div>
    </main>
  );
}
