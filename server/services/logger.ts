import pino from 'pino';

export type LogLevels = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const level = (process.env.LOG_LEVEL as LogLevels) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
});

export function createRequestLogger(scope: string) {
  return logger.child({ scope });
}
