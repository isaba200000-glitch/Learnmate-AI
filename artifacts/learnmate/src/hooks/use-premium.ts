import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
  type SubscriptionInfo,
} from "@workspace/api-client-react";

/**
 * Reads the current user's subscription status. Cached and shared across the
 * app (sidebar badge, premium pages, gated features).
 */
export function usePremium() {
  const query = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey() },
  });

  const subscription: SubscriptionInfo | undefined = query.data;
  const status = subscription?.status ?? "none";

  return {
    ...query,
    subscription,
    status,
    isPremium: status === "active",
    // Owner account: lifetime premium + admin panel access.
    isOwner: subscription?.isOwner === true,
    isLoadingPremium: query.isLoading,
  };
}
