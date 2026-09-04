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

describe("FoodiesFeedHome", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the landing story and fills an example without submitting", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      if (input.endsWith("/demo-session")) return response({ established: true });
      return response([]);
    }));

    render(<FoodiesFeedHome locale="en" />);
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/searches/recent"))).toBe(true));

    expect(screen.getByTestId("landing-story")).toBeInTheDocument();
    expect(screen.getByTestId("premium-preview")).toBeInTheDocument();
    const input = screen.getByTestId("search-input");
    fireEvent.click(screen.getByRole("button", { name: "cocoa spread" }));

    expect(input).toHaveValue("cocoa spread");
    expect(calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST")).toHaveLength(0);
  });

  it("keeps recent searches as actionable shelf-memory shortcuts", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches/recent")) {
        return response([{
          id: "recent-1",
          displayTerm: "oat biscuits",
          normalizedTerm: "oat biscuits",
          locale: "en",
          searchedAt: "2026-09-04T00:00:00.000Z",
        }]);
      }
      return response([]);
    }));

    render(<FoodiesFeedHome locale="en" />);
    await waitFor(() => expect(screen.getByRole("region", { name: "Recent searches" })).toBeInTheDocument());
    fireEvent.click(within(screen.getByRole("region", { name: "Recent searches" })).getByRole("button", { name: /oat biscuits/ }));

    await waitFor(() => expect(screen.getByTestId("no-results")).toBeInTheDocument());
    expect(calls.filter((call) => call.url.endsWith("/searches") && call.method === "POST")).toHaveLength(1);
  });

  it("does not search while typing and submits one validated request", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches/recent")) return response([]);
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
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/searches/recent"))).toBe(true));
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
    await waitFor(() => expect(calls.some((call) => call.endsWith("/searches/recent"))).toBe(true));
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "cocoa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    await waitFor(() => expect(screen.getAllByTestId("result-skeleton")).toHaveLength(4));
    resolveSearch(response([]));
    await waitFor(() => expect(screen.getByTestId("no-results")).toBeInTheDocument());
  });

  it("shows a localized validation message and makes no search request for a one-character query", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      calls.push(input);
      if (input.endsWith("/demo-session")) return response({ established: true });
      return response([]);
    }));
    render(<FoodiesFeedHome locale="de" />);
    await waitFor(() => expect(calls.some((call) => call.endsWith("/searches/recent"))).toBe(true));
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "x" } });
    fireEvent.submit(screen.getByRole("button", { name: "Suchen" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("mindestens zwei");
    expect(calls.filter((call) => call.endsWith("/searches"))).toHaveLength(0);
  });

  it.each(["en", "nl", "de", "fr"] as const)("shows the source-unavailable state in %s", async (locale) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches/recent")) return response([]);
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
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches/recent")) return response([]);
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
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches/recent")) return response([]);
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
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches/recent")) return response([]);
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
