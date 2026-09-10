import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-url";
import { getAuthToken } from "@workspace/api-client-react";

export interface AvailablePlans {
  monthly: { available: boolean };
  yearly: { available: boolean };
}

/**
 * Returns which payment tiers the server has configured.
 * Use this to hide the "yearly" tier card entirely when the yearly Whop
 * plan ID is not set — the /premium/whop/checkout/yearly endpoint returns
 * 503 in that case, so the UI should never show a button that 503s.
 *
 * Cached for 60 s; values rarely change between deploys.
 */
export function useAvailablePlans() {
  return useQuery<AvailablePlans>({
    queryKey: ["premium", "available-plans"],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch(apiUrl("/premium/available-plans"), {
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        // If the endpoint errors, assume both are available so the user
        // still sees the pricing page rather than an empty screen.
        return { monthly: { available: true }, yearly: { available: true } };
      }
      return (await res.json()) as AvailablePlans;
    },
    staleTime: 60_000,
  });
}
