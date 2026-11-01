// Fictional "Demo" requests for vendor discovery tests (004 T002). Hyderabad, exact coordinates with >= 4 decimals.
// Vendor base: 17.44, 78.38, radius 25 km. Distances are from the base to the 2-dp approximate location.
export const VENDOR_BASE = { latitude: 17.44, longitude: 78.38, service_radius_km: 25 } as const;

export type DiscoveryFixture = {
  key: string;
  status: "open" | "quoted" | "draft" | "accepted" | "closed";
  address_text: string;
  locality: string | null;
  latitude: number;
  longitude: number;
  monthly_units: number;
  monthly_bill: number;
  budget: number;
  preferred_capacity_kw: number | null;
  /** Rounded to 2 dp, as a vendor must see it. */
  approx: { latitude: number; longitude: number };
  /** Integer km from VENDOR_BASE; undefined for hidden requests. */
  expectedDistanceKm?: number;
  visible: boolean;
};

export const HOUSEHOLD_NAME = "Fixture Household Zeta";
export const HOUSEHOLD_PHONE = "+919812345678";

export const DISCOVERY_FIXTURES: DiscoveryFixture[] = [
  { key: "kondapur", status: "open", address_text: "Demo Plot 14, Fixture Lane, Kondapur", locality: "Kondapur, Hyderabad",
    latitude: 17.461234, longitude: 78.359876, monthly_units: 250, monthly_bill: 2100, budget: 150000, preferred_capacity_kw: 3,
    approx: { latitude: 17.46, longitude: 78.36 }, expectedDistanceKm: 3, visible: true },
  { key: "gachibowli", status: "quoted", address_text: "Demo Flat 7B, Fixture Towers, Gachibowli", locality: "Gachibowli, Hyderabad",
    latitude: 17.440412, longitude: 78.350321, monthly_units: 400, monthly_bill: 3500, budget: 200000, preferred_capacity_kw: 5,
    approx: { latitude: 17.44, longitude: 78.35 }, expectedDistanceKm: 3, visible: true },
  { key: "secunderabad", status: "open", address_text: "Demo House 3, Fixture Colony, Secunderabad", locality: "Secunderabad",
    latitude: 17.439876, longitude: 78.498123, monthly_units: 180, monthly_bill: 1500, budget: 90000, preferred_capacity_kw: null,
    approx: { latitude: 17.44, longitude: 78.5 }, expectedDistanceKm: 13, visible: true },
  { key: "nolocality", status: "open", address_text: "Demo Villa 9, Fixture Enclave, Hyderabad", locality: "Miyapur", // published requests require a locality (null only for drafts)
    latitude: 17.503456, longitude: 78.298765, monthly_units: 300, monthly_bill: 2600, budget: 100000, preferred_capacity_kw: 2,
    approx: { latitude: 17.5, longitude: 78.3 }, expectedDistanceKm: 11, visible: true },
  { key: "outside", status: "open", address_text: "Demo Farm 1, Fixture Road, Medchal", locality: "Medchal",
    latitude: 17.687654, longitude: 78.201234, monthly_units: 600, monthly_bill: 5200, budget: 250000, preferred_capacity_kw: 6,
    approx: { latitude: 17.69, longitude: 78.2 }, expectedDistanceKm: 34, visible: true },
  { key: "draft", status: "draft", address_text: "Demo Draft Address 21, Fixture Street", locality: "Kondapur, Hyderabad",
    latitude: 17.451111, longitude: 78.371111, monthly_units: 250, monthly_bill: 2100, budget: 150000, preferred_capacity_kw: 3,
    approx: { latitude: 17.45, longitude: 78.37 }, visible: false },
  { key: "accepted", status: "accepted", address_text: "Demo Accepted Address 22, Fixture Street", locality: "Kondapur, Hyderabad",
    latitude: 17.452222, longitude: 78.372222, monthly_units: 250, monthly_bill: 2100, budget: 150000, preferred_capacity_kw: 3,
    approx: { latitude: 17.45, longitude: 78.37 }, visible: false },
  { key: "closed", status: "closed", address_text: "Demo Closed Address 23, Fixture Street", locality: "Kondapur, Hyderabad",
    latitude: 17.453333, longitude: 78.373333, monthly_units: 250, monthly_bill: 2100, budget: 150000, preferred_capacity_kw: 3,
    approx: { latitude: 17.45, longitude: 78.37 }, visible: false },
];
