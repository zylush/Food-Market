import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

type FetchEventHandler = (event: {
  request: Request;
  respondWith: ReturnType<typeof vi.fn>;
}) => void;

async function loadServiceWorker() {
  const handlers = new Map<string, FetchEventHandler>();
  const cache = {
    add: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
    put: vi.fn(async () => undefined),
  };
  const caches = {
    delete: vi.fn(async () => true),
    keys: vi.fn(async () => []),
    match: vi.fn(async () => undefined),
    open: vi.fn(async () => cache),
  };
  const self = {
    addEventListener: (type: string, handler: FetchEventHandler) => handlers.set(type, handler),
    location: { origin: "https://foodiesfeed.test" },
  };
  const source = await readFile(resolve(process.cwd(), "apps/web/public/sw.js"), "utf8");

  runInNewContext(source, {
    Promise,
    Request,
    Response,
    URL,
    caches,
    fetch: vi.fn(async () => new Response("asset")),
    self,
  });

  return { caches, fetchHandler: handlers.get("fetch")! };
}

describe("FoodiesFeed service worker", () => {
  it("leaves replaceable Next build assets out of the offline cache", async () => {
    const { caches, fetchHandler } = await loadServiceWorker();
    const respondWith = vi.fn();

    fetchHandler({
      request: new Request("https://foodiesfeed.test/_next/static/chunks/app.css"),
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });

  it("keeps stable app assets available for offline use", async () => {
    const { fetchHandler } = await loadServiceWorker();
    const respondWith = vi.fn();

    fetchHandler({
      request: new Request("https://foodiesfeed.test/icons/icon-192.svg"),
      respondWith,
    });

    expect(respondWith).toHaveBeenCalledOnce();
    const response = respondWith.mock.calls[0]![0] as Promise<Response>;
    await response;
  });
});
