// Scripted AI outputs for roof analysis tests (contracts/roof-analysis-output.md §5).
const obs = (object: string, confidence: unknown = "medium") => ({
  object,
  description: `Visible ${object}`,
  potential_impact: "possible shading or space restriction",
  confidence,
});

export const validObstructed = {
  observations: [obs("water tank"), obs("staircase room", "high")],
  potential_obstructions: ["water tank", "staircase room"],
  limitations: [
    "A single image cannot establish exact roof dimensions",
    "Shading at different times of day is unknown",
    "Structural condition cannot be assessed",
  ],
  site_survey_required: true,
};
export const validEmpty = { observations: [], potential_obstructions: [], limitations: [], site_survey_required: true };
export const overReaching = {
  ...validObstructed,
  roof_area_sqm: 120,
  capacity_kw: 8,
  shading_hours: 3,
  observations: [{ ...obs("water tank"), area_m2: 4 }],
};
export const surveyFalse = { ...validObstructed, site_survey_required: false, limitations: [] };
export const notJson = "Sure! Here is the analysis of your roof.";
export const badConfidence = { ...validObstructed, observations: [obs("water tank", 0.8)] };
export const badConfidenceWord = { ...validObstructed, observations: [obs("water tank", "very high")] };
export const wrongTypes = { ...validObstructed, observations: { object: "water tank" } };
export const tooMany = { ...validObstructed, observations: Array.from({ length: 13 }, () => obs("tree")) };
export const tooLong = { ...validObstructed, observations: [{ ...obs("water tank"), description: "x".repeat(400) }] };
export const fencedJson = "```json\n" + JSON.stringify(validObstructed) + "\n```";
