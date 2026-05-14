import app from "./app.js";
import { env } from "./config/env.js";
import { syncPermissions } from "./db/permissions.js";

async function bootstrap() {
  await syncPermissions();

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
