import { createLogger, transports, format, Logger } from "winston";
import { config } from "./config";

const consoleTransport = new transports.Console({});

const logLevels = {
  emerg: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

let loggerInstance: Logger;

export function getNewInstanceOfLogger(
  metadata: Record<string, any> = {},
): Logger {
  return createLogger({
    transports: [consoleTransport /*, s3Transport*/],
    levels: logLevels,
    level: process.env.LOG_LEVEL || "info",
    defaultMeta: Object.assign(
      {},
      config.get("metadata"),
      {
        service: `bridge-back-end`,
      },
      metadata,
    ),
    format: format.combine(
      format.timestamp(),
      format.splat(),
      format.json(),
      format.colorize(),
    ),
  });
}

export function instantiateLogger(metadata: Record<string, any> = {}) {
  loggerInstance = getNewInstanceOfLogger(metadata);
}

export function logger(metadata: Record<string, any> = {}): Logger {
  return loggerInstance;
}

// export async function flushLogs(): Promise<void> {
//     if (!s3LogsEnabled) return;
//     return new Promise<void>((resolve) => {
//         s3stream.flushFile(() => resolve());
//     });
// }
