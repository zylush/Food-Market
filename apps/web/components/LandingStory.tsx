import Image from "next/image";
import type { Locale } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";
import { PremiumPrompt } from "./PremiumPrompt";

export function LandingStory({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <div className="landing-story-stack" data-testid="landing-story">
      <section id="how-it-works" className="landing-story" aria-labelledby="how-it-works-title">
        <div className="editorial-callout" data-testid="editorial-callout">
          <div className="editorial-callout__copy">
            <p className="eyebrow eyebrow--green">{dictionary.landingEyebrow}</p>
            <h2 id="how-it-works-title">{dictionary.landingTitle}</h2>
            <p>{dictionary.landingBody}</p>
          </div>
          <div className="editorial-callout__visual">
            <Image
              className="editorial-callout__image"
              src="/editorial-pantry-callout.png"
              alt={dictionary.editorialImageAlt}
              width={6144}
              height={4096}
              sizes="(max-width: 760px) calc(100vw - 28px), 52vw"
            />
          </div>
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
