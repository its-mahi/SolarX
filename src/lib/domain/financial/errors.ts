export class FinancialInputError extends Error {
  readonly code = "FINANCIAL_INPUT_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "FinancialInputError";
  }
}

export function assertFiniteNonNegative(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new FinancialInputError(`${label} must be a non-negative number`);
  }
}
