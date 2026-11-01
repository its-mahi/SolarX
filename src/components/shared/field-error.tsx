type Props = { id: string; message?: string };

/** Inline field error; link it to its input with aria-describedby={id}. */
export function FieldError({ id, message }: Props) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
