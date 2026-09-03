import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SiteHeader", () => {
  it("exposes the primary landing anchors beside the locale selector", () => {
    render(<SiteHeader locale="en" />);

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/en#search-title");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/en#how-it-works");
    expect(screen.getByRole("link", { name: "Premium" })).toHaveAttribute("href", "/en#premium");
  });
});
