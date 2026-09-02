import { ErrorCode } from "@foodiesfeed/contracts";
import { AppError, errorForCode, invalidRequest, isAppError, messageKeyForCode } from "./errors";

describe("application errors", () => {
  it("keeps stable public codes and message keys", () => {
    const error = errorForCode(ErrorCode.NotFound, 404, "missing");
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("missing");
    expect(error.status).toBe(404);
    expect(error.expose).toBe(true);
    expect(messageKeyForCode(ErrorCode.NotFound)).toBe("errors.notFound");
    expect(messageKeyForCode("UNKNOWN" as never)).toBe("errors.internal");
    expect(invalidRequest().code).toBe(ErrorCode.InvalidRequest);
    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("ordinary"))).toBe(false);
  });
});
