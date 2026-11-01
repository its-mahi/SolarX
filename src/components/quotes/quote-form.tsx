"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describedBy, fieldErrorsFromZod, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { INVERTER_TYPES, QUOTE_LIMITS, quoteFieldsSchema, type QuoteFields, type QuoteFieldsInput } from "@/lib/validation/quote";

/** Permitted request summary shown beside the form (props only, no fetching here). */
export type QuoteFormRequestSummary = {
  locality?: string | null;
  monthly_units?: number | null;
  budget_inr?: number | null;
  preferred_capacity_kw?: number | null;
};

export type QuoteFormProps = {
  request?: QuoteFormRequestSummary;
  /** Pre-fill (009 extraction passes the same keys). */
  defaultValues?: Partial<QuoteFieldsInput>;
  origin?: "manual" | "ai_extracted";
  onSubmit: (values: QuoteFields) => void | Promise<void>;
  submitting?: boolean;
  /** Field errors from the API (`fieldErrorsFromDetails`), merged over local errors. */
  serverErrors?: FieldErrors;
  /** Form-level error message, e.g. a 409 reason. */
  formError?: string;
};

/** Indian digit grouping, e.g. 165000 -> "₹1,65,000". */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

type Tri = "yes" | "no" | "unset";
type Draft = {
  price: string;
  capacity_kw: string;
  panel_brand: string;
  panel_model: string;
  panel_wattage: string;
  panel_quantity: string;
  panel_technology: string;
  panel_certifications: string;
  inv_brand: string;
  inv_model: string;
  inv_type: string;
  inv_capacity_kw: string;
  w_product: string;
  w_performance: string;
  w_inverter: string;
  w_workmanship: string;
  installation_days: string;
  earthing: Tri;
  documentation: Tri;
  other_inclusions: string;
  exclusions: string;
  vendor_notes: string;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const tri = (v: boolean | null | undefined): Tri => (v === true ? "yes" : v === false ? "no" : "unset");
const lines = (v: string[] | undefined) => (v ?? []).join("\n");

function toDraft(d: Partial<QuoteFieldsInput> = {}): Draft {
  return {
    price: str(d.price),
    capacity_kw: str(d.capacity_kw),
    panel_brand: str(d.panel_details?.brand),
    panel_model: str(d.panel_details?.model),
    panel_wattage: str(d.panel_details?.wattage),
    panel_quantity: str(d.panel_details?.quantity),
    panel_technology: str(d.panel_details?.technology),
    panel_certifications: lines(d.panel_details?.certifications),
    inv_brand: str(d.inverter_details?.brand),
    inv_model: str(d.inverter_details?.model),
    inv_type: str(d.inverter_details?.type),
    inv_capacity_kw: str(d.inverter_details?.capacity_kw),
    w_product: str(d.warranty_details?.panel_product_years),
    w_performance: str(d.warranty_details?.performance_years),
    w_inverter: str(d.warranty_details?.inverter_years),
    w_workmanship: str(d.warranty_details?.workmanship_years),
    installation_days: str(d.installation_days),
    earthing: tri(d.earthing_included),
    documentation: tri(d.documentation_included),
    other_inclusions: lines(d.other_inclusions),
    exclusions: str(d.exclusions),
    vendor_notes: str(d.vendor_notes),
  };
}

/** Required number: blank stays undefined so Zod reports it. Optional: blank is null. */
const reqNum = (v: string) => (v.trim() === "" ? undefined : Number(v));
const optNum = (v: string) => (v.trim() === "" ? null : Number(v));
const optText = (v: string) => (v.trim() === "" ? null : v);
const toList = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
const triValue = (v: Tri) => (v === "yes" ? true : v === "no" ? false : null);

function toPayload(d: Draft) {
  return {
    price: reqNum(d.price),
    capacity_kw: reqNum(d.capacity_kw),
    panel_details: {
      brand: optText(d.panel_brand),
      model: optText(d.panel_model),
      wattage: optNum(d.panel_wattage),
      quantity: optNum(d.panel_quantity),
      technology: optText(d.panel_technology),
      certifications: toList(d.panel_certifications),
    },
    inverter_details: {
      brand: optText(d.inv_brand),
      model: optText(d.inv_model),
      type: d.inv_type === "" ? null : d.inv_type,
      capacity_kw: optNum(d.inv_capacity_kw),
    },
    warranty_details: {
      panel_product_years: optNum(d.w_product),
      performance_years: optNum(d.w_performance),
      inverter_years: optNum(d.w_inverter),
      workmanship_years: optNum(d.w_workmanship),
    },
    installation_days: reqNum(d.installation_days),
    earthing_included: triValue(d.earthing),
    documentation_included: triValue(d.documentation),
    other_inclusions: toList(d.other_inclusions),
    exclusions: d.exclusions,
    vendor_notes: d.vendor_notes,
  };
}

/** Maps draft keys to the schema paths used in error messages (and as input names). */
const NAME: Record<keyof Draft, string> = {
  price: "price",
  capacity_kw: "capacity_kw",
  panel_brand: "panel_details.brand",
  panel_model: "panel_details.model",
  panel_wattage: "panel_details.wattage",
  panel_quantity: "panel_details.quantity",
  panel_technology: "panel_details.technology",
  panel_certifications: "panel_details.certifications",
  inv_brand: "inverter_details.brand",
  inv_model: "inverter_details.model",
  inv_type: "inverter_details.type",
  inv_capacity_kw: "inverter_details.capacity_kw",
  w_product: "warranty_details.panel_product_years",
  w_performance: "warranty_details.performance_years",
  w_inverter: "warranty_details.inverter_years",
  w_workmanship: "warranty_details.workmanship_years",
  installation_days: "installation_days",
  earthing: "earthing_included",
  documentation: "documentation_included",
  other_inclusions: "other_inclusions",
  exclusions: "exclusions",
  vendor_notes: "vendor_notes",
};

const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

export function QuoteForm({ request, defaultValues, origin = "manual", onSubmit, submitting = false, serverErrors, formError }: QuoteFormProps) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(defaultValues));
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const errors: FieldErrors = { ...localErrors, ...serverErrors };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const parsed = quoteFieldsSchema.safeParse(toPayload(draft));
    if (!parsed.success) {
      const next = fieldErrorsFromZod(parsed.error);
      setLocalErrors(next);
      focusFirstInvalid(formRef.current, next);
      return;
    }
    setLocalErrors({});
    await onSubmit(parsed.data);
  }

  const text = (key: Exclude<keyof Draft, "earthing" | "documentation">, label: string, opts: { type?: string; hint?: string; inputMode?: "numeric" | "decimal" | "text"; maxLength?: number; required?: boolean } = {}) => {
    const name = NAME[key];
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${uid}-${name}`}>
          {label}
          {opts.required ? <span aria-hidden="true"> *</span> : null}
        </Label>
        <Input
          id={`${uid}-${name}`}
          name={name}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength}
          required={opts.required}
          value={draft[key]}
          onChange={(e) => set(key, e.target.value as Draft[typeof key])}
          {...describedBy(errors, name)}
          aria-describedby={errors[name] ? `${name}-error` : opts.hint ? `${uid}-${name}-hint` : undefined}
        />
        {opts.hint ? (
          <p id={`${uid}-${name}-hint`} className="text-xs text-muted-foreground">
            {opts.hint}
          </p>
        ) : null}
        <FieldError id={`${name}-error`} message={errors[name]} />
      </div>
    );
  };

  const area = (key: "panel_certifications" | "other_inclusions" | "exclusions" | "vendor_notes", label: string, hint: string, max?: number) => {
    const name = NAME[key];
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${uid}-${name}`}>{label}</Label>
        <textarea
          id={`${uid}-${name}`}
          name={name}
          className={TEXTAREA_CLASS}
          value={draft[key]}
          onChange={(e) => set(key, e.target.value)}
          {...describedBy(errors, name)}
          aria-describedby={errors[name] ? `${name}-error` : `${uid}-${name}-hint`}
        />
        <p id={`${uid}-${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
          {max ? ` ${draft[key].length}/${max} characters.` : ""}
        </p>
        <FieldError id={`${name}-error`} message={errors[name]} />
      </div>
    );
  };

  const triField = (key: "earthing" | "documentation", legend: string) => {
    const name = NAME[key];
    const options: [Tri, string][] = [
      ["yes", "Included"],
      ["no", "Not included"],
      ["unset", "Not specified"],
    ];
    return (
      <fieldset className="flex flex-col gap-1.5" aria-describedby={errors[name] ? `${name}-error` : undefined}>
        <legend className="text-sm font-medium">{legend}</legend>
        <div className="flex flex-wrap gap-4">
          {options.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name={name} value={value} checked={draft[key] === value} onChange={() => set(key, value)} className="size-4 accent-primary" />
              {label}
            </label>
          ))}
        </div>
        <FieldError id={`${name}-error`} message={errors[name]} />
      </fieldset>
    );
  };

  const inverterTypeName = NAME.inv_type;

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={submitting} className="flex flex-col gap-6">
      {origin === "ai_extracted" ? (
        <p role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          Pre-filled — review every field before you submit.
        </p>
      ) : null}

      {request ? (
        <aside aria-label="Request summary" className="rounded-xl border bg-muted/40 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Request summary</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {request.locality ? (<><dt className="text-muted-foreground">Locality</dt><dd>{request.locality}</dd></>) : null}
            {request.monthly_units != null ? (<><dt className="text-muted-foreground">Monthly units</dt><dd>{request.monthly_units} kWh</dd></>) : null}
            {request.budget_inr != null ? (<><dt className="text-muted-foreground">Budget</dt><dd>{formatInr(request.budget_inr)}</dd></>) : null}
            {request.preferred_capacity_kw != null ? (<><dt className="text-muted-foreground">Preferred capacity</dt><dd>{request.preferred_capacity_kw} kW</dd></>) : null}
          </dl>
        </aside>
      ) : null}

      <Section title="Price and capacity">
        {text("price", "Total price (₹)", { inputMode: "numeric", required: true, hint: draft.price && Number(draft.price) > 0 ? `${formatInr(Number(draft.price))} (whole rupees, ${formatInr(QUOTE_LIMITS.priceMin)} to ${formatInr(QUOTE_LIMITS.priceMax)})` : `Whole rupees, ${formatInr(QUOTE_LIMITS.priceMin)} to ${formatInr(QUOTE_LIMITS.priceMax)}` })}
        {text("capacity_kw", "DC system capacity (kW)", { inputMode: "decimal", required: true, hint: "Up to 2 decimals, at most 100 kW." })}
      </Section>

      <Section title="Panels">
        {text("panel_brand", "Panel make", { maxLength: 100 })}
        {text("panel_model", "Panel model", { maxLength: 100 })}
        {text("panel_wattage", "Panel wattage (Wp)", { inputMode: "numeric" })}
        {text("panel_quantity", "Number of panels", { inputMode: "numeric" })}
        {text("panel_technology", "Panel technology", { maxLength: 100 })}
        {area("panel_certifications", "Panel certifications", "One per line, up to 10.")}
      </Section>

      <Section title="Inverter">
        {text("inv_brand", "Inverter make", { maxLength: 100 })}
        {text("inv_model", "Inverter model", { maxLength: 100 })}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-${inverterTypeName}`}>Inverter type</Label>
          <select
            id={`${uid}-${inverterTypeName}`}
            name={inverterTypeName}
            value={draft.inv_type}
            onChange={(e) => set("inv_type", e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-base md:text-sm dark:bg-input/30"
            {...describedBy(errors, inverterTypeName)}
          >
            <option value="">Not specified</option>
            {INVERTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <FieldError id={`${inverterTypeName}-error`} message={errors[inverterTypeName]} />
        </div>
        {text("inv_capacity_kw", "Inverter capacity (kW)", { inputMode: "decimal" })}
      </Section>

      <Section title="Warranty">
        {text("w_product", "Panel product warranty (years)", { inputMode: "numeric", hint: "Manufacturing defects. 0 to 40." })}
        {text("w_performance", "Panel performance warranty (years)", { inputMode: "numeric", hint: "Power output guarantee. 0 to 40." })}
        {text("w_inverter", "Inverter warranty (years)", { inputMode: "numeric" })}
        {text("w_workmanship", "Workmanship warranty (years)", { inputMode: "numeric" })}
      </Section>

      <Section title="Timeline">
        {text("installation_days", "Installation timeline (days)", { inputMode: "numeric", required: true, hint: "1 to 365 days." })}
      </Section>

      <Section title="Inclusions">
        {triField("earthing", "Earthing and protection")}
        {triField("documentation", "Metering and documentation support")}
        {area("other_inclusions", "Other inclusions", "One per line, up to 20.")}
      </Section>

      <Section title="Exclusions and terms">
        {area("exclusions", "Exclusions", "What the price does not cover.", QUOTE_LIMITS.longTextMax)}
        {area("vendor_notes", "Taxes, payment milestones and other terms", "Shown to the household as you wrote it.", QUOTE_LIMITS.longTextMax)}
      </Section>

      {formError || errors.form ? (
        <p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {formError ?? errors.form}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Submitting..." : "Submit quote"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 [&>fieldset]:sm:col-span-2 [&>div:has(textarea)]:sm:col-span-2">{children}</div>
    </section>
  );
}
