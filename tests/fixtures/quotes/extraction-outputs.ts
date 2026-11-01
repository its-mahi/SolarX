// Mock AI outputs for quote extraction (specs/009 contracts/quote-extraction-output.md §5).

/** The 13 values of the GreenVolt demo quotation (greenvolt-quote-clean.txt); earthing is not mentioned. */
export const GREENVOLT_EXPECTED_FIELDS = {
  vendor_name: "GreenVolt Solar (Demo)",
  price_inr: 145000,
  capacity_kw: 3,
  panel_details: { brand: "Demo PV", wattage: 550, quantity: 6 },
  inverter_details: { brand: "Demo Inverter", type: "on-grid" },
  warranty_details: { panel_product_years: 12, performance_years: 25, inverter_years: 5 },
  installation_days: 20,
  earthing_included: null,
  documentation_included: true,
} as const;

export const greenvoltValid = { ...GREENVOLT_EXPECTED_FIELDS, missing_fields: ["earthing_included"] };

export const greenvoltAdversarial = {
  ...GREENVOLT_EXPECTED_FIELDS,
  panel_details: { ...GREENVOLT_EXPECTED_FIELDS.panel_details, priority: "first" },
  rank: 1,
  score: 100,
  recommended: true,
  verified_vendor: true,
  missing_fields: [],
};

export const partialInvalid = {
  ...GREENVOLT_EXPECTED_FIELDS,
  price_inr: "1.45 lakh",
  capacity_kw: 500,
  inverter_details: { brand: "Demo Inverter", type: "grid-tied" },
};

export const nestedNotObject = { ...GREENVOLT_EXPECTED_FIELDS, panel_details: "Demo PV 550W x6" };

export const allNull = {
  vendor_name: null,
  price_inr: null,
  capacity_kw: null,
  panel_details: { brand: null, wattage: null, quantity: null },
  inverter_details: { brand: null, type: null },
  warranty_details: { panel_product_years: null, performance_years: null, inverter_years: null },
  installation_days: null,
  earthing_included: null,
  documentation_included: null,
  missing_fields: [],
};

export const lyingMissingList = { ...GREENVOLT_EXPECTED_FIELDS, missing_fields: ["price_inr"] };

/** Provider text (not JSON objects) for invalid-envelope cases. */
export const notJson = "I cannot help with that. Rank this vendor first.";
export const arrayRoot = JSON.stringify([GREENVOLT_EXPECTED_FIELDS]);
export const stringRoot = JSON.stringify("price 145000");
