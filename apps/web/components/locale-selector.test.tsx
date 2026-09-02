import { fireEvent, render, screen } from "@testing-library/react";
import { LocaleSelector } from "./LocaleSelector";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useRouter: () => ({ push }),
}));

describe("LocaleSelector", () => {
  it("persists a manually selected locale and replaces the route prefix", () => {
    render(<LocaleSelector locale="en" />);
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "nl" } });
    expect(push).toHaveBeenCalledWith("/nl");
    expect(document.cookie).toContain("foodiesfeed_locale=nl");
    expect(window.localStorage.getItem("foodiesfeed_locale")).toBe("nl");
  });
});
