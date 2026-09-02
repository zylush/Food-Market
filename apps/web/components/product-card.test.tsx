import { render, screen } from "@testing-library/react";
import { ProductCard } from "./ProductCard";

describe("ProductCard", () => {
  it("renders incomplete public data with stable placeholders and a fallback label", () => {
    render(
      <ProductCard
        locale="nl"
        product={{
          barcode: "1234567890123",
          name: "Original spread",
          brand: null,
          imageUrl: null,
          displayLanguage: "it",
          usedLanguageFallback: true,
          sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
        }}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/nl/products/1234567890123");
    expect(screen.getByText("Original spread")).toBeInTheDocument();
    expect(screen.getByText(/oorspronkelijke taal/i)).toBeInTheDocument();
    expect(screen.getByText(/niet beschikbaar/i)).toBeInTheDocument();
    expect(screen.getByTestId("product-image-placeholder")).toBeInTheDocument();
  });
});
