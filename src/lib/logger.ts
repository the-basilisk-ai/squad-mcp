type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;

const shouldLog = (level: LogLevel): boolean => levels[level] >= (levels[currentLevel] ?? levels.info);

const timestamp = (): string => {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `[${h}:${m}:${s}.${ms}]`;
};

export const logger = {
  debug: (data: Record<string, unknown>, msg: string) => {
    if (shouldLog('debug')) console.debug(`${timestamp()} [DEBUG] ${msg}`, data);
  },
  info: (msg: string) => {
    if (shouldLog('info')) console.info(`${timestamp()} ${msg}`);
  },
  warn: (data: Record<string, unknown>, msg: string) => {
    if (shouldLog('warn')) console.warn(`${timestamp()} [WARN] ${msg}`, data);
  },
  error: (data: Record<string, unknown>, msg: string) => {
    if (shouldLog('error')) console.error(`${timestamp()} [ERROR] ${msg}`, data);
  },
  fatal: (msgOrData: string | Record<string, unknown>, msg?: string) => {
    if (shouldLog('fatal')) {
      if (typeof msgOrData === 'string') {
        console.error(`${timestamp()} [FATAL] ${msgOrData}`);
      } else {
        console.error(`${timestamp()} [FATAL] ${msg}`, msgOrData);
      }
    }
  },
};
