import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";

const config = loadConfig();
const logger = createLogger({ level: config.logLevel });
const webRoot = fileURLToPath(new URL("../public", import.meta.url));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  const pathname = req.url === "/" ? "/index.html" : req.url;
  const filePath = join(webRoot, pathname);

  try {
    const body = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("content-type", contentTypes[extname(filePath)] ?? "text/plain; charset=utf-8");
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(webRoot, "index.html"));
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Not found");
    }
  }
});

server.listen(config.webPort, config.webHost, () => {
  logger.info("web_started", {
    host: config.webHost,
    port: config.webPort,
    environment: config.appEnv
  });
});
