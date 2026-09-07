import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach } from "vitest";
import { FoodiesFeedHome } from "./FoodiesFeedHome";
import { getDictionary } from "../i18n/dictionaries";

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(status >= 400 ? { error: data } : { data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function product(index: number) {
  return {
    barcode: `80000000000${index}`,
    name: `Product ${index}`,
    brand: "FoodiesFeed test pantry",
    imageUrl: null,
    displayLanguage: "en",
    usedLanguageFallback: false,
    sourceUrl: `https://world.openfoodfacts.org/product/80000000000${index}`,
  };
}

describe("FoodiesFeedHome", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the generated pantry background decorative behind the hero content", async () => {
    render(<FoodiesFeedHome locale="en" />);

    const hero = screen.getByTestId("hero");
    const background = screen.getByTestId("hero-background");
    const content = screen.getByTestId("hero-content");

    expect(hero).toHaveClass("hero--pantry-background");
    expect(hero).not.toHaveClass("page-width");
    expect(content).toHaveClass("hero__inner", "page-width");
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(hero).toContainElement(background);
    expect(hero).toContainElement(content);
    await waitFor(() => expect(screen.getByTestId("premium-access-error")).toBeInTheDocument());
  });

  it("uses a compact search bar and editorial divider without shelf memory", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/entitlements")) return response({ canViewNutrition: false, subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });
      return response([]);
    }));

    render(<FoodiesFeedHome locale="en" />);

    expect(screen.getByTestId("landing-story")).toBeInTheDocument();
    expect(screen.getByTestId("editorial-callout")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Everyday pantry food arranged for a closer look at the label." })).toBeInTheDocument();
    expect(screen.getByTestId("search-bar")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent searches" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("premium-preview")).toBeInTheDocument());
    const input = screen.getByTestId("search-input");
    fireEvent.click(screen.getByRole("button", { name: "cocoa spread" }));

    expect(input).toHaveValue("cocoa spread");
    expect(calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST")).toHaveLength(0);
  });

  it("paginates shelf matches locally without another product-source request", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      if (input.endsWith("/searches") && init?.method === "POST") return response(Array.from({ length: 7 }, (_, index) => product(index + 1)));
      return response([]);
    }));

    render(<FoodiesFeedHome locale="en" />);
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    await waitFor(() => expect(screen.getByText("Product 1")).toBeInTheDocument());
    expect(screen.queryByText("Product 7")).not.toBeInTheDocument();
    const pagination = screen.getByRole("navigation", { name: "Product results pages" });
    expect(within(pagination).getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(pagination).getByRole("button", { name: "Page 2" }));
    expect(screen.getByText("Product 7")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
    expect(calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST")).toHaveLength(1);
  });

  it("does not search while typing and submits one validated request", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      return response([
        {
          barcode: "1234567890123",
          name: "Cocoa spread",
          brand: "Acme",
          imageUrl: null,
          displayLanguage: "en",
          usedLanguageFallback: false,
          sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
        },
      ]);
    }));

    render(<FoodiesFeedHome locale="en" />);
    const searchCallsBeforeTyping = calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST").length;
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    expect(calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST")).toHaveLength(searchCallsBeforeTyping);

    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Cocoa spread")).toBeInTheDocument());
    expect(screen.queryByTestId("landing-story")).not.toBeInTheDocument();
    expect(calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST")).toHaveLength(1);
  });

  it("holds the result workspace with reserved cards while a search is loading", async () => {
    const calls: string[] = [];
    let resolveSearch!: (result: Response) => void;
    const pendingSearch = new Promise<Response>((resolve) => {
      resolveSearch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((input: string) => {
      calls.push(input);
      if (input.endsWith("/demo-session")) return Promise.resolve(response({ established: true }));
      if (input.endsWith("/searches/recent")) return Promise.resolve(response([]));
      return pendingSearch;
    }));

    render(<FoodiesFeedHome locale="en" />);
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    await waitFor(() => expect(screen.getAllByTestId("result-skeleton")).toHaveLength(6));
    resolveSearch(response([]));
    await waitFor(() => expect(screen.getByTestId("no-results")).toBeInTheDocument());
  });

  it("shows a localized validation message and makes no search request for a one-character query", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      calls.push(input);
      return response([]);
    }));
    render(<FoodiesFeedHome locale="de" />);
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "x" } });
    fireEvent.submit(screen.getByRole("button", { name: "Suchen" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("mindestens zwei");
    expect(calls.filter((call) => call.endsWith("/searches"))).toHaveLength(0);
  });

  it.each(["en", "nl", "de", "fr"] as const)("shows the source-unavailable state in %s", async (locale) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      return response({ code: "UPSTREAM_UNAVAILABLE" }, 503);
    }));

    render(<FoodiesFeedHome locale={locale} />);
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: getDictionary(locale).searchButton }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(getDictionary(locale).errorsUpstreamUnavailable));
  });

  it("shows a source-timeout message instead of the general unavailable state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      return response({ code: "UPSTREAM_TIMEOUT" }, 504);
    }));

    render(<FoodiesFeedHome locale="en" />);
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The product source took too long to respond. Please try again."));
  });

  it("separates a browser-network failure from a product-source failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/searches") && init?.method === "POST") throw new Error("browser offline");
      return response([]);
    }));

    render(<FoodiesFeedHome locale="en" />);
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not reach FoodiesFeed. Check your connection and try again."));
  });

  it("disables retry until a valid rate-limit window expires", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      return new Response(JSON.stringify({ error: { code: "UPSTREAM_RATE_LIMITED" } }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "1" },
      });
    }));

    render(<FoodiesFeedHome locale="en" />);
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("button", { name: "Try again in 1s" })).toBeDisabled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled(), { timeout: 2_500 });
  });
});
