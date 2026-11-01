import { CircleAlert, Info } from "lucide-react";
import { MISSING_LABELS } from "@/lib/domain/quotes/missing-fields";
import type { Flag, MissingField } from "@/lib/domain/quotes";

export function QuoteFlags({ missingFields, flags }: { missingFields: MissingField[]; flags: Flag[] }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {missingFields.length === 0 ? (
        <p className="text-muted-foreground">All recommended details provided.</p>
      ) : (
        <div>
          <p className="font-medium">Not stated by the vendor</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {missingFields.map((m) => (
              <li key={m}>{MISSING_LABELS[m]}: not stated</li>
            ))}
          </ul>
        </div>
      )}
      {flags.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Flags">
          {flags.map((f) => (
            <li key={f.code} className="flex items-start gap-2">
              {f.severity === "warning" ? (
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span>
                <span className="font-medium">{f.severity === "warning" ? "Warning: " : "Note: "}</span>
                {f.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
