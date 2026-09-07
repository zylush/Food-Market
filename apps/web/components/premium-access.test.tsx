import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PremiumAccess } from "./PremiumAccess";

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(status >= 400 ? { error: data } : { data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PremiumAccess", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("replaces the upgrade prompt with active access and a confirmed cancellation path", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      calls.push(input);
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/entitlements")) return response({
        canViewNutrition: true,
        subscriptionStatus: "active",
        currentPeriodEnd: "2026-09-30T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      if (input.endsWith("/billing/cancel")) return response({
        canViewNutrition: true,
        subscriptionStatus: "active",
        currentPeriodEnd: "2026-09-30T00:00:00.000Z",
        cancelAtPeriodEnd: true,
      });
      return response({});
    }));

    render(<PremiumAccess locale="en" />);

    await waitFor(() => expect(screen.getByTestId("premium-access")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Unlock nutrition" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
    expect(screen.getByTestId("cancel-confirmation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel at period end" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cancellation scheduled"));
    expect(calls).toEqual(["/api/v1/demo-session", "/api/v1/entitlements", "/api/v1/billing/cancel"]);
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("keeps the upgrade prompt for a confirmed free entitlement", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/entitlements")) return response({
        canViewNutrition: false,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      return response({});
    }));

    render(<PremiumAccess locale="en" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Unlock nutrition" })).toBeInTheDocument());
  });

  it("does not guess when premium status cannot be confirmed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.endsWith("/demo-session")) return response({ established: true });
      return response({ code: "NETWORK_UNAVAILABLE" }, 503);
    }));

    render(<PremiumAccess locale="en" />);

    await waitFor(() => expect(screen.getByTestId("premium-access-error")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Unlock nutrition" })).not.toBeInTheDocument();
  });
});
