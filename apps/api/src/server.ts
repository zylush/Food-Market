import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrismaRepository } from "./db/prisma.js";
import { InMemoryRepository } from "./db/repository.js";
import { OpenFoodFactsHttpGateway } from "./integrations/open-food-facts.js";
import { StripeApiGateway, UnavailableStripeGateway } from "./integrations/stripe.js";

const config = loadConfig();
const database = config.databaseUrl ? createPrismaRepository(config.databaseUrl) : null;
if (config.nodeEnv === "production" && !database) {
  throw new Error("DATABASE_URL is required in production");
}
const repository = database?.repository ?? new InMemoryRepository();
const gateway = new OpenFoodFactsHttpGateway({
  baseUrl: config.openFoodFactsBaseUrl,
  userAgent: config.openFoodFactsUserAgent,
});
const stripe = config.stripeSecretKey && config.stripeWebhookSecret
  ? new StripeApiGateway(config.stripeSecretKey, config.stripeWebhookSecret)
  : new UnavailableStripeGateway();

const app = createApp({ config, repository, gateway, stripe });
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(JSON.stringify({ event: "api_started", port, persistence: database ? "mysql" : "memory-dev-only" }));
});
