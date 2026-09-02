import "dotenv/config";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createPrismaRepository } from "../src/db/prisma";
import { OpenFoodFactsHttpGateway } from "../src/integrations/open-food-facts";
import { StripeApiGateway } from "../src/integrations/stripe";

const config = loadConfig();
const database = createPrismaRepository(config.databaseUrl);
const gateway = new OpenFoodFactsHttpGateway({
  baseUrl: config.openFoodFactsBaseUrl,
  userAgent: config.openFoodFactsUserAgent,
});
const stripe = new StripeApiGateway(config.stripeSecretKey, config.stripeWebhookSecret);

const app = createApp({ config, repository: database.repository, gateway, stripe });
export default app;
