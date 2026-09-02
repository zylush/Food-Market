import {
  API_ERROR_MESSAGE_KEYS,
  ErrorCode,
  type ErrorCodeValue,
} from "@foodiesfeed/contracts";

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly expose: boolean;

  constructor(code: ErrorCodeValue, status: number, message?: string, expose = true) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.expose = expose;
  }
}

export function errorForCode(code: ErrorCodeValue, status: number, message?: string): AppError {
  return new AppError(code, status, message);
}

export function messageKeyForCode(code: ErrorCodeValue): string {
  return API_ERROR_MESSAGE_KEYS[code] ?? API_ERROR_MESSAGE_KEYS[ErrorCode.InternalError];
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const invalidRequest = (message?: string) => errorForCode(ErrorCode.InvalidRequest, 400, message);
