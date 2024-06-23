import { getNewInstanceOfLogger, logger } from "../logger";

export const trueLogger = () => {
  return logger() ? logger() : getNewInstanceOfLogger();
};

const parseArgs = (args: Record<string, any>): string => {
  const namedArgs = Object.values(args)
    .map((val) => {
      let arg = val;
      try {
        if (typeof val === "object") {
          arg = JSON.stringify(val)
            .replace(/\\\"/g, "~~~") // template replacement of quote
            .replace(/\"/g, "'")
            .replace(/~~~/g, '"'); // back to quote
        }
      } catch (e) {
        //
      }
      return `${arg}`;
    })
    .join(", ");
  return `${namedArgs}`;
};

export const handleInfo = (
  where: string,
  what: string,
  method = "",
  args: Record<string, any> = {},
) => {
  try {
    trueLogger().info(
      `${where}${method ? "." : ""}${method}` +
        `${Object.keys(args).length ? "(" + parseArgs(args) + ")" : ""}` +
        ` => ` +
        what,
    );
  } catch (e) {
    trueLogger().emerg("utils: handleInfo => " + e);
  }
};

export const handleError = (
  where: string,
  method: string,
  args: Record<string, any> = {},
  error: any,
) => {
  try {
    trueLogger().error(
      `${where}.${method}(` + parseArgs(args) + ") => " + error,
    );
    // place for messaging
  } catch (e) {
    trueLogger().emerg("utils: handleError => " + e);
  }
};

export const handleEmergency = (
  where: string,
  method: string,
  args: Record<string, any> = {},
  error: any,
) => {
  try {
    trueLogger().emerg(
      `${where}.${method}(` + parseArgs(args) + ") => " + error,
    );
    // place for messaging
  } catch (e) {
    trueLogger().emerg("utils: handleEmergency => " + e);
  }
};
