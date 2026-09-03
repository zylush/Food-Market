import type { Locale, RecentSearch } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";

export function RecentSearches({
  locale,
  recent,
  sessionNotice,
  onSelect,
}: {
  locale: Locale;
  recent: RecentSearch[];
  sessionNotice: boolean;
  onSelect: (item: RecentSearch) => void;
}) {
  const dictionary = getDictionary(locale);

  return (
    <section className="recent-section" aria-labelledby="recent-title">
      <div className="section-heading section-heading--small">
        <p className="eyebrow">{dictionary.recentEyebrow}</p>
        <h2 id="recent-title">{dictionary.recentTitle}</h2>
      </div>
      {sessionNotice ? <p className="muted-copy">{dictionary.sessionUnavailable}</p> : null}
      {!sessionNotice && recent.length === 0 ? <p className="muted-copy">{dictionary.recentEmpty}</p> : null}
      {recent.length > 0 ? (
        <ul className="recent-list">
          {recent.slice(0, 10).map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item)}>
                <span>{item.displayTerm}</span>
                <small>{item.locale.toUpperCase()}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
