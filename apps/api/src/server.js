import http from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { closeDatabasePools } from "../../../packages/database/src/index.js";

const config = loadConfig();
const logger = createLogger({ level: config.logLevel });
const server = http.createServer(createApp({ config, logger }));

server.listen(config.apiPort, config.apiHost, () => {
  logger.info("api_started", {
    host: config.apiHost,
    port: config.apiPort,
    environment: config.appEnv
  });
});

process.on("uncaughtException", (error) => {
  logger.error("uncaught_exception", { error: error.message, stack: error.stack });
  shutdown(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { error: reason?.message ?? String(reason), stack: reason?.stack });
  shutdown(1);
});

process.on("SIGTERM", () => {
  logger.info("api_stopping", {});
  shutdown(0);
});

process.on("SIGINT", () => {
  logger.info("api_stopping", {});
  shutdown(0);
});

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(async () => {
    await closeDatabasePools();
    process.exit(code);
  });
}
