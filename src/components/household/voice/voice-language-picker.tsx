"use client";

import { useId } from "react";
import { VOICE_LANGUAGE_LABELS } from "@/lib/voice/language-support";
import { VOICE_LANGUAGES, type VoiceLanguage } from "@/lib/validation/voice";

type Props = { value: VoiceLanguage; onChange: (language: VoiceLanguage) => void; disabled?: boolean };

export function VoiceLanguagePicker({ value, onChange, disabled }: Props) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Speaking language
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as VoiceLanguage)}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {VOICE_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {VOICE_LANGUAGE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
