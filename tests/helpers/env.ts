// Loads environment variables for integration tests: .env.test overrides .env.local.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env.test", override: true, quiet: true });
