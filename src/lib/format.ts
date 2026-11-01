// Display formatting for money, units, capacity and dates (Indian digit grouping).
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const units = new Intl.NumberFormat("en-IN");

export function formatInr(amount: number): string {
  return inr.format(amount);
}

export function formatUnits(value: number): string {
  return `${units.format(value)} units (kWh)`;
}

export function formatKw(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)} kW`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
