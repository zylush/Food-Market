"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@foodiesfeed/contracts";
import { getDictionary } from "../i18n/dictionaries";
import { ApiClientError, bootstrapSession, fetchEntitlement } from "../features/api";

export function CheckoutProcessing({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const [state, setState] = useState<"checking" | "active" | "delayed">("checking");

  const checkEntitlement = useCallback(async (): Promise<void> => {
    setState("checking");
    try {
      await bootstrapSession();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const entitlement = await fetchEntitlement();
        if (entitlement.canViewNutrition) {
          setState("active");
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      }
    } catch (error) {
      if (!(error instanceof ApiClientError)) setState("delayed");
    }
    setState("delayed");
  }, []);

  useEffect(() => {
    void checkEntitlement();
  }, [checkEntitlement]);

  return (
    <main id="main-content" className="page-width status-page" aria-live="polite">
      <p className="eyebrow eyebrow--green">CHECKOUT / CONFIRMATION</p>
      <h1>{state === "active" ? dictionary.activeTitle : dictionary.checkoutProcessingTitle}</h1>
      <p>{state === "active" ? dictionary.activeBody : state === "delayed" ? dictionary.checkoutDelayed : dictionary.checkoutProcessingBody}</p>
      {state === "checking" ? <div className="progress-line" role="status">{dictionary.searching}</div> : null}
      {state === "active" ? <a className="button button--dark" href={`/${locale}`}>{dictionary.returnToSearch}</a> : <button className="button button--dark" type="button" onClick={() => void checkEntitlement()}>{dictionary.refreshEntitlement}</button>}
    </main>
  );
}
