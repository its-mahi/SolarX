"use client";
// Voice entry for the usage step. Never blocks or hides the manual inputs; applies nothing
// until the household presses "Use these values".
import { useId } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VOICE_LANGUAGE_LABELS } from "@/lib/voice/language-support";
import { VOICE_TRANSCRIPT_MAX_CHARS } from "@/lib/validation/voice";
import type { UsageFields } from "@/lib/validation/requests";
import { VoiceLanguagePicker } from "./voice-language-picker";
import { VoiceReviewCard } from "./voice-review-card";
import { useVoiceCapture } from "./use-voice-capture";
import type { VoicePanelState } from "./voice-panel-reducer";

const ERROR_TEXT: Record<NonNullable<VoicePanelState["error"]>, string> = {
  no_speech: "We didn't hear anything. Try again, or type your values below.",
  permission:
    "Microphone access is blocked. Allow the microphone in your browser's site settings, or type your values below.",
  no_mic: "No microphone was found. Type your values below.",
  recognition: "Voice recognition stopped unexpectedly. Try again, or type your values below.",
  language_unsupported: "This language is not supported here. Try English, or type your values below.",
  ai_unavailable: "Voice analysis is unavailable right now. Retry, or type your values below.",
  request_failed: "We could not interpret that. Retry, or type your values below.",
};

export function VoiceEntryPanel({
  onSuggest,
  disabled = false,
}: {
  onSuggest: (values: Partial<UsageFields>) => void;
  disabled?: boolean;
}) {
  const v = useVoiceCapture();
  const { state } = v;
  const transcriptId = useId();
  if (disabled) return null;

  const listening = state.phase === "listening";
  const busy = state.phase === "interpreting";
  const showTranscript = ["transcript_ready", "review", "empty", "unsupported", "error", "interpreting"].includes(state.phase);

  let live = "";
  if (listening) live = "Listening";
  else if (busy) live = "Interpreting what you said";
  else if (state.phase === "review") live = "Review the values we understood";
  else if (state.phase === "empty") live = state.empty === "no_speech" ? "We did not hear anything" : "No values understood";
  else if (state.phase === "error" && state.error) live = ERROR_TEXT[state.error];

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" data-testid="voice-entry-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Speak your details (optional)</h3>
        <VoiceLanguagePicker value={state.language} onChange={v.setLanguage} disabled={listening || busy} />
      </div>

      {state.languageNotice ? (
        <p role="note" className="text-sm">
          {VOICE_LANGUAGE_LABELS[state.languageNotice]} isn&apos;t supported in this browser, so we switched to English.
        </p>
      ) : null}

      {state.supported ? (
        <Button
          type="button"
          variant={listening ? "destructive" : "outline"}
          className="h-11 gap-2 px-4"
          aria-pressed={listening}
          disabled={busy}
          onClick={listening ? v.stop : v.start}
        >
          {listening ? <Square aria-hidden /> : <Mic aria-hidden />}
          {listening ? "Stop listening" : "Start voice input"}
        </Button>
      ) : (
        <p className="text-sm">
          Voice input isn&apos;t available in this browser. Type your values below, or type what you would say here.
        </p>
      )}

      {listening ? (
        <p className="text-sm font-medium">
          <span aria-hidden>● </span>Listening… speak now (stops after 30 seconds).
        </p>
      ) : null}
      {busy ? <p className="text-sm">Interpreting what you said…</p> : null}

      {state.phase === "empty" ? (
        <p className="text-sm">
          {state.empty === "no_speech"
            ? "We didn't hear anything. Try again, or type your values."
            : "We couldn't pick out any values. Try again, or type your values."}
        </p>
      ) : null}
      {state.phase === "error" && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_TEXT[state.error]}
        </p>
      ) : null}

      {listening && state.transcript ? <p className="text-sm italic">{state.transcript}</p> : null}

      {showTranscript ? (
        <div className="space-y-2">
          <label htmlFor={transcriptId} className="text-sm font-medium">
            What we heard — you can correct it
          </label>
          <textarea
            id={transcriptId}
            value={state.transcript}
            maxLength={VOICE_TRANSCRIPT_MAX_CHARS}
            disabled={busy}
            rows={2}
            onChange={(e) => v.editTranscript(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" className="h-11 px-4" disabled={busy || !state.transcript.trim()} onClick={v.interpret}>
              {state.phase === "review" ? "Interpret again" : "Interpret"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {state.transcript.length}/{VOICE_TRANSCRIPT_MAX_CHARS}
            </span>
          </div>
        </div>
      ) : null}

      {state.phase === "review" && state.result ? (
        <VoiceReviewCard
          key={state.attemptId}
          result={state.result}
          transcript={state.transcript}
          onUse={(values) => {
            onSuggest(values);
            v.reset();
          }}
          onDiscard={v.reset}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        Your browser&apos;s speech service turns speech into text and may process the audio. SURYAMIT receives only the
        text.
      </p>
      <div aria-live="polite" role="status" className="sr-only">
        {live}
      </div>
    </div>
  );
}
