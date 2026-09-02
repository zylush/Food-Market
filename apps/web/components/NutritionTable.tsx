import type { Locale, NutritionDetails } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";

const fields = [
  ["energyKj", "energyKj"],
  ["energyKcal", "energyKcal"],
  ["fatG", "fatG"],
  ["saturatedFatG", "saturatedFatG"],
  ["carbohydratesG", "carbohydratesG"],
  ["sugarsG", "sugarsG"],
  ["fibreG", "fibreG"],
  ["proteinG", "proteinG"],
  ["saltG", "saltG"],
  ["sodiumG", "sodiumG"],
] as const;

const valueKeys: Record<(typeof fields)[number][0], keyof NutritionDetails> = {
  energyKj: "energyKj",
  energyKcal: "energyKcal",
  fatG: "fatG",
  saturatedFatG: "saturatedFatG",
  carbohydratesG: "carbohydratesG",
  sugarsG: "sugarsG",
  fibreG: "fibreG",
  proteinG: "proteinG",
  saltG: "saltG",
  sodiumG: "sodiumG",
};

export function NutritionTable({ locale, nutrition }: { locale: Locale; nutrition: NutritionDetails }) {
  const dictionary = getDictionary(locale);
  const basis = nutrition.basis ?? dictionary.unavailable;
  return (
    <section className="nutrition-section" aria-labelledby="nutrition-title">
      <div className="section-heading section-heading--lined">
        <div>
          <p className="eyebrow">{dictionary.premiumEyebrow}</p>
          <h2 id="nutrition-title">{dictionary.nutritionTitle}</h2>
        </div>
        <p className="nutrition-basis"><span>{dictionary.nutritionBasis}</span>{basis}</p>
      </div>
      <div className="nutrition-meta">
        <span>{dictionary.servingSize}: {nutrition.servingSize ?? dictionary.unavailable}</span>
        <span>{dictionary.sourceAttribution}</span>
      </div>
      <table className="nutrition-table">
        <thead>
          <tr><th scope="col">{dictionary.nutritionTitle}</th><th scope="col">{basis}</th></tr>
        </thead>
        <tbody>
          {fields.map(([labelKey, dictionaryKey]) => {
            const rawValue = nutrition[valueKeys[labelKey]];
            return (
              <tr key={labelKey}>
                <th scope="row">{dictionary[dictionaryKey]}</th>
                <td>{typeof rawValue === "number" ? rawValue.toLocaleString(locale, { maximumFractionDigits: 2 }) : dictionary.unavailable}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
