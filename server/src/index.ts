import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const startServer = async () => {
  app.listen(env.PORT, () => {
    logger.info("server_started", { port: env.PORT });
  });
};

startServer();
