import type { CanonicalItem, SavingsResult } from "@/types/canonical";
import { unitPricePence } from "./sizeParser";

/**
 * Computes what the Ocado line (price x quantity) would cost on Amazon.
 *
 * Preferred basis is unit price (pence per 100g/100ml/each) so different pack
 * sizes compare fairly. Falls back to pack-vs-pack price when sizes are
 * unknown or in incompatible units.
 */
export function computeSavings(
  ocado: CanonicalItem,
  amazon: CanonicalItem,
): SavingsResult {
  const ocadoUnit = ocado.unitPricePence ?? unitPricePence(ocado.pricePence, ocado.size);
  const amazonUnit =
    amazon.unitPricePence ?? unitPricePence(amazon.pricePence, amazon.size);

  const ocadoLineCost = ocado.pricePence * ocado.quantity;

  const sameUnit =
    ocado.size && amazon.size && ocado.size.unit === amazon.size.unit;

  if (sameUnit && ocadoUnit !== undefined && amazonUnit !== undefined) {
    // Cost of the same total amount of product at Amazon's unit price.
    const ref = ocado.size!.unit === "each" ? 1 : 100;
    const totalOcadoAmount =
      ocado.size!.count * ocado.size!.amount * ocado.quantity;
    const amazonEquivalentCost = (amazonUnit * totalOcadoAmount) / ref;
    const savingsPence = Math.round(ocadoLineCost - amazonEquivalentCost);
    return {
      basis: "unit",
      savingsPence,
      savingsFraction: ocadoLineCost > 0 ? savingsPence / ocadoLineCost : 0,
      ocadoUnitPricePence: ocadoUnit,
      amazonUnitPricePence: amazonUnit,
    };
  }

  // Pack-vs-pack fallback.
  const savingsPence = (ocado.pricePence - amazon.pricePence) * ocado.quantity;
  return {
    basis: "pack",
    savingsPence,
    savingsFraction: ocadoLineCost > 0 ? savingsPence / ocadoLineCost : 0,
    ocadoUnitPricePence: ocadoUnit,
    amazonUnitPricePence: amazonUnit,
  };
}
