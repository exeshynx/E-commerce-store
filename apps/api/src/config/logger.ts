type LogContext = Record<string, unknown>;

const write = (level: 'info' | 'warn' | 'error', message: string, context?: LogContext) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  });

  if (level === 'error') {
    console.error(entry);
    return;
  }

  if (level === 'warn') {
    console.warn(entry);
    return;
  }

  console.info(entry);
};

export const logger = {
  error: (message: string, context?: LogContext) => write('error', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
};
