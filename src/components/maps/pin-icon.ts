import L from "leaflet";

// Lucide "map-pin" drawn as a divIcon so no marker image files are needed.
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#1f7a4d" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>';

export const pinIcon = L.divIcon({
  html: PIN_SVG,
  className: "suryamit-pin",
  iconSize: [36, 36],
  iconAnchor: [18, 34],
});

export const DEFAULT_CENTER: [number, number] = [17.385, 78.4867]; // Hyderabad
