"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Entitlement, Locale } from "@foodiesfeed/contracts";
import { bootstrapSession, cancelSubscription, fetchEntitlement } from "../features/api";
import { getDictionary, translate } from "../i18n/dictionaries";
import { PremiumPrompt } from "./PremiumPrompt";

type AccessState = "loading" | "ready" | "error";

function formatAccessDate(locale: Locale, value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function PremiumAccess({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [state, setState] = useState<AccessState>("loading");
  const [confirming, setConfirming] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const mountedRef = useRef(false);

  const loadEntitlement = useCallback(async (): Promise<void> => {
    if (mountedRef.current) setState("loading");
    try {
      await bootstrapSession();
      const nextEntitlement = await fetchEntitlement();
      if (!mountedRef.current) return;
      setEntitlement(nextEntitlement);
      setState("ready");
    } catch {
      if (!mountedRef.current) return;
      setEntitlement(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadEntitlement();
    return () => {
      mountedRef.current = false;
    };
  }, [loadEntitlement]);

  async function confirmCancellation(): Promise<void> {
    setCancelLoading(true);
    setCancelError(false);
    try {
      const nextEntitlement = await cancelSubscription();
      if (!mountedRef.current) return;
      setEntitlement(nextEntitlement);
      setConfirming(false);
    } catch {
      if (!mountedRef.current) return;
      setCancelError(true);
    } finally {
      if (mountedRef.current) setCancelLoading(false);
    }
  }

  if (state === "loading") {
    return (
      <aside className="subscription-status subscription-status--loading" data-testid="premium-access-loading" aria-busy="true">
        <p className="eyebrow">{dictionary.premiumEyebrow}</p>
        <p>{dictionary.premiumStatusLoading}</p>
      </aside>
    );
  }

  if (state === "error" || !entitlement) {
    return (
      <aside className="subscription-status subscription-status--error" data-testid="premium-access-error" role="status">
        <p className="eyebrow">{dictionary.premiumEyebrow}</p>
        <p>{dictionary.premiumStatusUnavailable}</p>
        <button className="text-button" type="button" onClick={() => void loadEntitlement()}>{dictionary.retry}</button>
      </aside>
    );
  }

  if (!entitlement.canViewNutrition && entitlement.subscriptionStatus !== "active") {
    return <PremiumPrompt locale={locale} variant="featured" />;
  }

  const accessDate = formatAccessDate(locale, entitlement.currentPeriodEnd);

  return (
    <aside className="subscription-status" data-testid="premium-access" aria-labelledby="premium-access-title">
      <p className="eyebrow">{dictionary.premiumEyebrow}</p>
      <h2 id="premium-access-title">{dictionary.activeTitle}</h2>
      <p>{dictionary.activeBody}</p>
      {accessDate ? <p className="subscription-status__meta">{translate(locale, "subscriptionAccessUntil", { date: accessDate })}</p> : null}

      {entitlement.cancelAtPeriodEnd ? (
        <p className="subscription-status__scheduled" role="status">
          {accessDate
            ? translate(locale, "cancelSubscriptionScheduled", { date: accessDate })
            : dictionary.cancelSubscriptionScheduledNoDate}
        </p>
      ) : (
        <div className="subscription-status__actions">
          {!confirming ? (
            <button
              className="button button--tomato"
              type="button"
              aria-expanded="false"
              onClick={() => {
                setCancelError(false);
                setConfirming(true);
              }}
            >
              {dictionary.cancelSubscription}
            </button>
          ) : (
            <div className="subscription-status__confirm" data-testid="cancel-confirmation">
              <p>{dictionary.cancelSubscriptionBody}</p>
              <div className="subscription-status__confirm-actions">
                <button className="button button--dark" type="button" onClick={() => void confirmCancellation()} disabled={cancelLoading}>
                  {cancelLoading ? dictionary.cancelSubscriptionWorking : dictionary.cancelSubscriptionConfirm}
                </button>
                <button className="text-button" type="button" onClick={() => setConfirming(false)} disabled={cancelLoading}>
                  {dictionary.keepSubscription}
                </button>
              </div>
            </div>
          )}
          {cancelError ? <p className="inline-error" role="alert">{dictionary.errorsSubscriptionCancellationUnavailable}</p> : null}
        </div>
      )}
    </aside>
  );
}
