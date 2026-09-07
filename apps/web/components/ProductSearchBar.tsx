import type { Locale } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";

export function ProductSearchBar({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <section className="product-search search-bar" data-testid="product-search-bar" aria-label={dictionary.searchLabel}>
      <form className="search-bar__form" action={`/${locale}`} method="get">
        <label className="search-bar__label" htmlFor="product-page-search">{dictionary.searchLabel}</label>
        <div className="search-bar__row">
          <input
            id="product-page-search"
            name="q"
            type="search"
            placeholder={dictionary.searchPlaceholder}
            autoComplete="off"
          />
          <button className="button button--tomato" type="submit">{dictionary.searchButton}</button>
        </div>
        <div className="search-bar__footer">
          <p className="search-bar__hint">{dictionary.searchHint}</p>
        </div>
      </form>
    </section>
  );
}
