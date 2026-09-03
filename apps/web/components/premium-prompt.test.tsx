import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PremiumPrompt } from "./PremiumPrompt";

describe("PremiumPrompt", () => {
  it("bootstraps a demo session before requesting checkout", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      requests.push(input);
      if (input.endsWith("/demo-session")) {
        return new Response(JSON.stringify({ data: { established: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: { code: "CHECKOUT_UNAVAILABLE" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }));

    render(<PremiumPrompt locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Unlock nutrition" }));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests).toEqual(["/api/v1/demo-session", "/api/v1/billing/checkout"]);
  });

  it("surfaces a recoverable checkout error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "CHECKOUT_UNAVAILABLE" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })));
    render(<PremiumPrompt locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Unlock nutrition" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable"));
  });
});
