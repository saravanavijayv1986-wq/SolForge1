interface LogContext {
  service?: string;
  endpoint?: string;
  userId?: string;
  transactionId?: string;
  requestId?: string;
  [key: string]: any;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName: string;
  private logLevel: LogLevel;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private createLogEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.serviceName,
        ...context,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    // In production, this would integrate with a proper logging service
    // For now, we'll use console with structured output
    const logString = JSON.stringify(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.createLogEntry('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.createLogEntry('info', message, context));
    }
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog('warn')) {
      this.output(this.createLogEntry('warn', message, context, error));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog('error')) {
      this.output(this.createLogEntry('error', message, context, error));
    }
  }

  // Performance logging
  time(label: string, context?: LogContext): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`Timer: ${label} completed`, {
        ...context,
        duration: `${duration}ms`,
        performance: true,
      });
    };
  }

  // Transaction logging
  transaction(txSig: string, action: string, context?: LogContext): void {
    this.info(`Transaction: ${action}`, {
      ...context,
      transactionSignature: txSig,
      action,
      type: 'transaction',
    });
  }

  // Security logging
  security(message: string, context?: LogContext): void {
    this.warn(`Security: ${message}`, {
      ...context,
      type: 'security',
    });
  }

  // API request logging
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, {
      ...context,
      httpMethod: method,
      httpPath: path,
      type: 'api',
    });
  }

  // API response logging
  apiResponse(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this[level](`API Response: ${method} ${path} - ${statusCode}`, {
      ...context,
      httpMethod: method,
      httpPath: path,
      httpStatusCode: statusCode,
      responseDuration: `${duration}ms`,
      type: 'api',
    });
  }

  // Database operation logging
  database(operation: string, table: string, duration?: number, context?: LogContext): void {
    this.debug(`Database: ${operation} on ${table}`, {
      ...context,
      dbOperation: operation,
      dbTable: table,
      duration: duration ? `${duration}ms` : undefined,
      type: 'database',
    });
  }

  // Error with stack trace
  errorWithStack(message: string, error: Error, context?: LogContext): void {
    this.error(message, {
      ...context,
      errorType: error.constructor.name,
    }, error);
  }
}

// Create service-specific loggers
export const createLogger = (serviceName: string): Logger => {
  return new Logger(serviceName);
};

// Default logger
export const logger = createLogger('app');

// Export Logger class for custom implementations
export { Logger };
export type { LogContext, LogLevel };
