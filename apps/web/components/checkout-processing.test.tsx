import { act, render, screen, waitFor } from "@testing-library/react";
import { CheckoutProcessing } from "./CheckoutProcessing";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("CheckoutProcessing", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows active only after the entitlement endpoint confirms it", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.endsWith("/demo-session")) return jsonResponse({ established: true });
      return jsonResponse({ canViewNutrition: true, subscriptionStatus: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false });
    }));
    render(<CheckoutProcessing locale="en" />);
    await waitFor(() => expect(screen.getByText("Premium nutrition is active")).toBeInTheDocument());
  });

  it("stops polling and offers a manual refresh when confirmation is delayed", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.endsWith("/demo-session")) return jsonResponse({ established: true });
      return jsonResponse({ canViewNutrition: false, subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });
    }));
    render(<CheckoutProcessing locale="en" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_500);
    });
    expect(screen.getByText("Confirmation is taking longer than usual. Refresh when you are ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh access" })).toBeInTheDocument();
  });
});
