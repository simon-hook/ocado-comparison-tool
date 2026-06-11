import type { CanonicalItem } from "@/types/canonical";
import type { BasketProvider } from "../types";
import { toCanonical } from "../normalise";
import fixture from "./__fixtures__/basket.json";

/** Serves the fixture basket — used for development and tests. */
export class MockOcadoProvider implements BasketProvider {
  async fetchBasket(): Promise<CanonicalItem[]> {
    return fixture.items.map((item) =>
      toCanonical("ocado", {
        id: item.sku,
        title: item.title,
        brand: item.brand,
        quantity: item.quantity,
        pricePence: item.pricePence,
        url: item.url,
      }),
    );
  }
}
