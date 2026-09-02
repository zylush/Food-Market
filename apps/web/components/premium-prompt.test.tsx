import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PremiumPrompt } from "./PremiumPrompt";

describe("PremiumPrompt", () => {
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
