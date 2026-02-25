export class PayrollError extends Error {
  constructor(
    message: string,
    public code: number
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown): void {
  // Error handling logic
  // eslint-disable-next-line no-console
  console.error("API Error:", error);
}
