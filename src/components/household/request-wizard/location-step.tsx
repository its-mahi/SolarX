"use client";

import { useRef, useState, type FormEvent } from "react";
import { LocationPickerLazy } from "@/components/maps/location-picker-lazy";
import { FieldError } from "@/components/shared/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describedBy, fieldErrorsFromDetails, fieldErrorsFromZod, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { locationFieldsSchema } from "@/lib/validation/requests";
import { StepActions } from "./step-actions";
import type { StepProps } from "./step-types";
import { createRequest, patchRequest } from "./use-request-api";

export function LocationStep({ request, onContinue, onConflict }: StepProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [latitude, setLatitude] = useState<number | null>(request?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(request?.longitude ?? null);
  const [address, setAddress] = useState(request?.address_text ?? "");
  const [locality, setLocality] = useState(request?.locality ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { latitude, longitude, address_text: address, locality };
    const parsed = locationFieldsSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrorsFromZod(parsed.error);
      if (latitude === null) next.latitude = "Place a pin on the map or enter a latitude";
      if (longitude === null) next.longitude = "Place a pin on the map or enter a longitude";
      setErrors(next);
      focusFirstInvalid(formRef.current, next);
      return;
    }
    setErrors({});
    setPending(true);
    const result = request ? await patchRequest(request.id, parsed.data) : await createRequest(parsed.data);
    setPending(false);
    if (result.ok) return onContinue(result.data);
    if (result.status === 409) return onConflict();
    const next = fieldErrorsFromDetails(result.details);
    setErrors(Object.keys(next).length ? next : { form: result.message });
    focusFirstInvalid(formRef.current, next);
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">Click the map to drop a pin on your roof location. Only vendors you accept will ever see it exactly.</p>
      <LocationPickerLazy
        latitude={latitude}
        longitude={longitude}
        onChange={(lat, lng) => {
          setLatitude(lat);
          setLongitude(lng);
          setErrors((e) => ({ ...e, latitude: "", longitude: "" }));
        }}
        latitudeError={errors.latitude}
        longitudeError={errors.longitude}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address_text">Address</Label>
        <Input
          id="address_text"
          name="address_text"
          className="h-11"
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          {...describedBy(errors, "address_text")}
        />
        <FieldError id="address_text-error" message={errors.address_text} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="locality">Locality or area</Label>
        <Input id="locality" name="locality" className="h-11" value={locality} onChange={(e) => setLocality(e.target.value)} {...describedBy(errors, "locality")} />
        <FieldError id="locality-error" message={errors.locality} />
      </div>
      {errors.form ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <StepActions pending={pending} />
    </form>
  );
}
