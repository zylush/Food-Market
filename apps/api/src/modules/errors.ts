import {
  API_ERROR_MESSAGE_KEYS,
  ErrorCode,
  type ErrorCodeValue,
} from "@foodiesfeed/contracts";

export type UpstreamFailureKind = "timeout" | "network" | "http" | "malformed";

export interface UpstreamFailureLogContext {
  provider: "open_food_facts";
  failureKind: UpstreamFailureKind;
  upstreamStatus?: number;
  attempts: number;
  elapsedMs: number;
  retryAfterSeconds?: number;
}

interface AppErrorOptions {
  retryAfter?: string;
  logContext?: UpstreamFailureLogContext;
}

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly expose: boolean;
  readonly retryAfter: string | undefined;
  readonly logContext: UpstreamFailureLogContext | undefined;

  constructor(code: ErrorCodeValue, status: number, message?: string, expose = true, options: AppErrorOptions = {}) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.expose = expose;
    this.retryAfter = options.retryAfter;
    this.logContext = options.logContext;
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
