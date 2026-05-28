// Shared Stripe customer helpers for Edge Functions.
// When switching from test to live API keys, profiles may still store test-mode
// customer ids — Stripe returns resource_missing for those against live keys.

import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

export function isStripeMissingResource(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { type?: string; code?: string; statusCode?: number };
  return (
    (e.type === "StripeInvalidRequestError" && e.code === "resource_missing") ||
    e.statusCode === 404
  );
}

/** Returns the stored id if it exists in the current Stripe mode; otherwise null. */
export async function getValidStripeCustomerId(
  stripe: Stripe,
  storedId: string | null | undefined,
): Promise<string | null> {
  if (!storedId) return null;
  try {
    const customer = await stripe.customers.retrieve(storedId);
    if ("deleted" in customer && customer.deleted) return null;
    return storedId;
  } catch (err) {
    if (isStripeMissingResource(err)) return null;
    throw err;
  }
}
