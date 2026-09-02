import type { Entitlement } from "@foodiesfeed/contracts";

export interface SubscriptionEntitlementRecord {
  status: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export function canViewNutrition(subscription: Pick<SubscriptionEntitlementRecord, "status"> | null): boolean {
  return subscription?.status === "active";
}

export function toEntitlement(subscription: SubscriptionEntitlementRecord | null): Entitlement {
  return {
    canViewNutrition: canViewNutrition(subscription),
    subscriptionStatus: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
  };
}
