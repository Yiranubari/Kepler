import http from "node:http";
import { env } from "./config/env";
import { LOG_SERVICE_NAMES, SHUTDOWN_TIMEOUT_MS } from "./config/constants";
import { Logger } from "./services/logger";
import { Lifecycle } from "./services/lifecycle";
import { createApp, getLimiter } from "./app";

const rootLogger = new Logger({
  level: env.LOG_LEVEL,
  logDir: env.LOG_DIR,
  serviceName: LOG_SERVICE_NAMES.lifecycle,
  environment: env.NODE_ENV,
});

const lifecycleLogger = rootLogger.getLogger(LOG_SERVICE_NAMES.lifecycle);
const httpLogger = rootLogger.getLogger(LOG_SERVICE_NAMES.http);

const lifecycle = new Lifecycle(lifecycleLogger);
const limiter = getLimiter();
const app = createApp(limiter, httpLogger);

let server: http.Server | undefined;

lifecycle.registerStartupHook("httpServer", async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server = http.createServer(app);
    server.listen(env.PORT, () => {
      httpLogger.info("http_server_bound", {
        address: server?.address(),
        port: env.PORT,
      });
      resolve();
    });
    server.once("error", (err) => {
      reject(err);
    });
  });
});

lifecycle.registerShutdownHook("httpServerClose", async (): Promise<void> => {
  if (!server) {
    return;
  }
  const currentServer = server;
  await new Promise<void>((resolve) => {
    let closed = false;
    const timeout = setTimeout(() => {
      if (!closed) {
        httpLogger.warn("http_server_close_timeout_force_closing", {
          timeoutMs: SHUTDOWN_TIMEOUT_MS,
        });
        currentServer.closeAllConnections();
        resolve();
      }
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref();

    currentServer.close((err) => {
      closed = true;
      clearTimeout(timeout);
      if (err) {
        httpLogger.warn("http_server_close_error", { error: err.message });
      }
      resolve();
    });
  });
});

lifecycle.attachSignalHandlers(lifecycleLogger);

lifecycle.start().then(() => {
  httpLogger.info("kepler server started", {
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});
