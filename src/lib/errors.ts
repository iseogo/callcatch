export class CallCatchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CallCatchError";
  }
}

export class RetellApiError extends CallCatchError {
  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message, "RETELL_API_ERROR", statusCode ?? 502, cause);
    this.name = "RetellApiError";
  }
}

export class SignalWireApiError extends CallCatchError {
  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message, "SIGNALWIRE_API_ERROR", statusCode ?? 502, cause);
    this.name = "SignalWireApiError";
  }
}

export class GoogleCalendarError extends CallCatchError {
  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message, "GOOGLE_CALENDAR_ERROR", statusCode ?? 502, cause);
    this.name = "GoogleCalendarError";
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
