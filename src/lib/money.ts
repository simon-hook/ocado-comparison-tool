/** Format integer pence as a GBP string: 1234 -> "£12.34", 95 -> "95p". */
export function formatPence(pence: number): string {
  const abs = Math.abs(Math.round(pence));
  const sign = pence < 0 ? "-" : "";
  if (abs < 100) return `${sign}${abs}p`;
  return `${sign}£${(abs / 100).toFixed(2)}`;
}

/** Format a unit price with its reference unit, e.g. "30p/100ml". */
export function formatUnitPrice(
  pence: number,
  unit: "g" | "ml" | "each",
): string {
  const ref = unit === "each" ? "each" : `100${unit}`;
  return `${formatPence(pence)}/${ref}`;
}
