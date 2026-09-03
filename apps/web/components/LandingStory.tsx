import type { Locale } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";
import { PremiumPrompt } from "./PremiumPrompt";

export function LandingStory({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <div className="landing-story-stack" data-testid="landing-story">
      <section id="how-it-works" className="landing-story" aria-labelledby="how-it-works-title">
        <div className="landing-story__header">
          <p className="eyebrow eyebrow--green">{dictionary.landingEyebrow}</p>
          <h2 id="how-it-works-title">{dictionary.landingTitle}</h2>
          <p>{dictionary.landingBody}</p>
        </div>
        <ol className="landing-steps">
          <li>
            <span className="landing-step__number" aria-hidden="true">01</span>
            <div>
              <h3>{dictionary.landingStepOneTitle}</h3>
              <p>{dictionary.landingStepOneBody}</p>
            </div>
          </li>
          <li>
            <span className="landing-step__number" aria-hidden="true">02</span>
            <div>
              <h3>{dictionary.landingStepTwoTitle}</h3>
              <p>{dictionary.landingStepTwoBody}</p>
            </div>
          </li>
          <li>
            <span className="landing-step__number" aria-hidden="true">03</span>
            <div>
              <h3>{dictionary.landingStepThreeTitle}</h3>
              <p>{dictionary.landingStepThreeBody}</p>
            </div>
          </li>
        </ol>
      </section>

      <div id="premium" className="landing-premium">
        <PremiumPrompt locale={locale} variant="featured" />
      </div>
    </div>
  );
}
