import { render, screen, waitFor } from "@testing-library/react";
import { ProductView } from "./ProductView";

const product = {
  barcode: "1234567890123",
  name: "Cocoa spread",
  brand: null,
  imageUrl: null,
  displayLanguage: "en",
  usedLanguageFallback: false,
  sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(status >= 400 ? { error: data } : { data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProductView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps public product facts visible when free nutrition is denied", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("/products/1234567890123?")) return jsonResponse(product);
      if (input.endsWith("/demo-session")) return jsonResponse({ established: true });
      return jsonResponse({ code: "SUBSCRIPTION_REQUIRED" }, 403);
    }));
    render(<ProductView locale="en" barcode="1234567890123" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Cocoa spread" })).toBeInTheDocument());
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "See the numbers when they matter." })).toBeInTheDocument();
    expect(screen.getByTestId("product-image-placeholder")).toBeInTheDocument();
  });

  it("renders approved nutrition values after the protected endpoint succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("/products/1234567890123?")) return jsonResponse({ ...product, brand: "Acme" });
      if (input.endsWith("/demo-session")) return jsonResponse({ established: true });
      return jsonResponse({ basis: "100g", servingSize: "30 g", energyKj: 1800, energyKcal: null, fatG: null, saturatedFatG: null, carbohydratesG: null, sugarsG: null, fibreG: null, proteinG: null, saltG: null, sodiumG: null });
    }));
    render(<ProductView locale="en" barcode="1234567890123" />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.getByText("1,800")).toBeInTheDocument();
    expect(screen.getByText(/Serving size/).parentElement).toHaveTextContent("30 g");
  });
});
