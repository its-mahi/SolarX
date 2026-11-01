"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useId, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_CENTER, pinIcon } from "./pin-icon";

export type LocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
  latitudeError?: string;
  longitudeError?: string;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(round6(e.latlng.lat), round6(e.latlng.lng)) });
  return null;
}

function Recenter({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (latitude !== null && longitude !== null) map.setView([latitude, longitude], Math.max(map.getZoom(), 14));
  }, [map, latitude, longitude]);
  return null;
}

const parse = (text: string): number | null => {
  const n = Number(text.trim());
  return text.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function LocationPicker({ latitude, longitude, onChange, latitudeError, longitudeError }: LocationPickerProps) {
  const uid = useId();
  const [latText, setLatText] = useState(latitude === null ? "" : latitude.toFixed(6));
  const [lngText, setLngText] = useState(longitude === null ? "" : longitude.toFixed(6));
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);

  // Keep the text boxes in step when the pin moves from the map or the device location.
  const [synced, setSynced] = useState({ latitude, longitude });
  if (synced.latitude !== latitude || synced.longitude !== longitude) {
    setSynced({ latitude, longitude });
    if (parse(latText) !== latitude) setLatText(latitude === null ? "" : latitude.toFixed(6));
    if (parse(lngText) !== longitude) setLngText(longitude === null ? "" : longitude.toFixed(6));
  }

  const place = (lat: number, lng: number) => {
    setGeoMessage(null);
    onChange(lat, lng);
  };

  function useMyLocation() {
    setGeoMessage(null);
    if (!("geolocation" in navigator)) {
      setGeoMessage("Your browser cannot share its location. Click the map or type the coordinates instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        place(round6(pos.coords.latitude), round6(pos.coords.longitude));
      },
      (err) => {
        setLocating(false);
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Click the map or type the coordinates instead."
            : "We could not find your location. Click the map or type the coordinates instead.",
        );
      },
      { timeout: 10_000 },
    );
  }

  const hasPin = latitude !== null && longitude !== null;
  const center: [number, number] = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="application"
        aria-label="Map for choosing your roof location. Click to place a pin, or use the coordinate boxes below."
        className="h-72 w-full overflow-hidden rounded-lg border sm:h-80"
      >
        <MapContainer center={center} zoom={hasPin ? 14 : 11} scrollWheelZoom={false} keyboard className="h-full w-full">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }}
          />
          <ClickToPlace onPick={place} />
          <Recenter latitude={latitude} longitude={longitude} />
          {hasPin ? (
            <Marker
              position={[latitude, longitude]}
              icon={pinIcon}
              draggable
              keyboard={false}
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng();
                  place(round6(p.lat), round6(p.lng));
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      {tileError ? (
        <p role="status" className="text-sm text-muted-foreground">
          The map could not load. You can still type your latitude and longitude below.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-lat`}>Latitude</Label>
          <Input
            id={`${uid}-lat`}
            name="latitude"
            inputMode="decimal"
            className="h-11"
            value={latText}
            onChange={(e) => {
              setLatText(e.target.value);
              onChange(parse(e.target.value), parse(lngText));
            }}
            aria-invalid={latitudeError ? true : undefined}
            aria-describedby={latitudeError ? `${uid}-lat-error` : undefined}
          />
          <FieldError id={`${uid}-lat-error`} message={latitudeError} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-lng`}>Longitude</Label>
          <Input
            id={`${uid}-lng`}
            name="longitude"
            inputMode="decimal"
            className="h-11"
            value={lngText}
            onChange={(e) => {
              setLngText(e.target.value);
              onChange(parse(latText), parse(e.target.value));
            }}
            aria-invalid={longitudeError ? true : undefined}
            aria-describedby={longitudeError ? `${uid}-lng-error` : undefined}
          />
          <FieldError id={`${uid}-lng-error`} message={longitudeError} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11 w-fit" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 aria-hidden className="animate-spin" /> : <LocateFixed aria-hidden />}
          {locating ? "Finding your location…" : "Use my location"}
        </Button>
        {geoMessage ? (
          <p role="status" className="text-sm text-muted-foreground">
            {geoMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
