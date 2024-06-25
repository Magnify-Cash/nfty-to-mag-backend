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
      format.json(),
      format.align(),
      format.errors(),
    ),
  });
}

export function instantiateLogger(metadata: Record<string, any> = {}) {
  loggerInstance = getNewInstanceOfLogger(metadata);
}

export function logger(): Logger {
  return loggerInstance;
}
