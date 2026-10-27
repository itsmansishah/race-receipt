// Loads .env.local etc. the same way `next dev` does. Import this first in every script.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
