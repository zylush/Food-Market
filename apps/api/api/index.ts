import "dotenv/config";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPrismaRepository } from "../src/db/prisma.js";
import { OpenFoodFactsHttpGateway } from "../src/integrations/open-food-facts.js";
import { StripeApiGateway } from "../src/integrations/stripe.js";

const config = loadConfig();
const database = createPrismaRepository(config.databaseUrl);
const gateway = new OpenFoodFactsHttpGateway({
  baseUrl: config.openFoodFactsBaseUrl,
  userAgent: config.openFoodFactsUserAgent,
});
const stripe = new StripeApiGateway(config.stripeSecretKey, config.stripeWebhookSecret);

const app = createApp({ config, repository: database.repository, gateway, stripe });
export default app;
