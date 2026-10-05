type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};
const VALID_LEVELS: readonly LogLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
];
const currentLevel: LogLevel = VALID_LEVELS.includes(
  process.env.LOG_LEVEL as LogLevel,
)
  ? (process.env.LOG_LEVEL as LogLevel)
  : "info";

const shouldLog = (level: LogLevel): boolean =>
  levels[level] >= (levels[currentLevel] ?? levels.info);

const timestamp = (): string => {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  return `[${h}:${m}:${s}.${ms}]`;
};

export const logger = {
  debug: (data: Record<string, unknown>, msg: string) => {
    if (shouldLog("debug"))
      console.debug("%s [DEBUG] %s", timestamp(), msg, data);
  },
  info: (msg: string) => {
    if (shouldLog("info")) console.info("%s %s", timestamp(), msg);
  },
  warn: (data: Record<string, unknown>, msg: string) => {
    if (shouldLog("warn")) console.warn("%s [WARN] %s", timestamp(), msg, data);
  },
  error: (data: Record<string, unknown>, msg: string) => {
    if (shouldLog("error"))
      console.error("%s [ERROR] %s", timestamp(), msg, data);
  },
  fatal: (msgOrData: string | Record<string, unknown>, msg?: string) => {
    if (shouldLog("fatal")) {
      if (typeof msgOrData === "string") {
        console.error("%s [FATAL] %s", timestamp(), msgOrData);
      } else {
        console.error("%s [FATAL] %s", timestamp(), msg, msgOrData);
      }
    }
  },
};
