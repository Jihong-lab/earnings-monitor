import "server-only";
import { config } from "dotenv";

// In dev, force-load .env.local so it overrides any pre-set empty values inherited
// from the shell (e.g. harness/CI environments that pre-declare ANTHROPIC_API_KEY="").
// In production (Vercel), .env.local is not present and dotenv silently no-ops.
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local", override: true });
}
