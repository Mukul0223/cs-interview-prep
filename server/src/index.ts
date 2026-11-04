import app from "./app.js";
import { env } from "./config/env.js";

const startServer = async () => {
  app.listen(env.PORT, () => {
    console.log(`Server running on port: ${env.PORT}`);
  });
};

startServer();
