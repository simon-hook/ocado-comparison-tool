import type { CanonicalItem } from "@/types/canonical";

/** Fetches the user's current basket from a grocery retailer. */
export interface BasketProvider {
  /**
   * Returns the live basket as canonical items.
   * Throws BasketAuthError when a manual sign-in is needed (MFA/captcha).
   */
  fetchBasket(): Promise<CanonicalItem[]>;
}

/** Searches a comparison retailer for candidate products. */
export interface AmazonProvider {
  /** Returns top candidates for a query (Prime flag populated when known). */
  search(query: string): Promise<CanonicalItem[]>;
}

/** Raised when automated login fails and the user must intervene. */
export class BasketAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BasketAuthError";
  }
}
