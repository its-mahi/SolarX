const inr = new Intl.NumberFormat("en-IN");
export const formatInr = (n: number | null) => (n === null ? "Not provided" : `₹${inr.format(n)}`);
export const formatKw = (n: number | null) => (n === null ? "Not specified" : `${n} kW`);
export const formatDistance = (km: number | null) => (km === null ? "Distance unavailable" : `≈ ${km} km`);
export const formatPosted = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
