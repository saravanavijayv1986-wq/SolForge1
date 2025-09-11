import React from 'react';
import { toast } from '@/components/ui/use-toast';

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
  retryable?: boolean;
}

export class NetworkError extends Error implements AppError {
  code: string;
  statusCode?: number;
  details?: any;
  retryable: boolean;

  constructor(message: string, code: string = 'NETWORK_ERROR', statusCode?: number, retryable: boolean = true) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export class ValidationError extends Error implements AppError {
  code: string;
  details?: any;
  retryable: boolean;

  constructor(message: string, field?: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.details = { field, ...details };
    this.retryable = false;
  }
}

export class SolanaError extends Error implements AppError {
  code: string;
  statusCode?: number;
  details?: any;
  retryable: boolean;

  constructor(message: string, code: string = 'SOLANA_ERROR', retryable: boolean = true) {
    super(message);
    this.name = 'SolanaError';
    this.code = code;
    this.retryable = retryable;
  }
}

// Error codes
export const ERROR_CODES = {
  // Network errors
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Solana errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  BLOCKHASH_EXPIRED: 'BLOCKHASH_EXPIRED',
  
  // Business logic errors
  TOKEN_EXISTS: 'TOKEN_EXISTS',
  PURCHASE_FAILED: 'PURCHASE_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
} as const;

// Error parsing function
export function parseError(error: any): AppError {
  // If it's already an AppError, return as is
  if (error instanceof NetworkError || error instanceof ValidationError || error instanceof SolanaError) {
    return error;
  }

  const message = error?.message || 'An unexpected error occurred';
  const statusCode = error?.status || error?.statusCode;

  // Network errors
  if (message.includes('fetch') || message.includes('Network Error') || statusCode >= 500) {
    return new NetworkError(
      'Network connection failed. Please check your internet connection.',
      ERROR_CODES.NETWORK_UNAVAILABLE,
      statusCode
    );
  }

  // Rate limiting
  if (statusCode === 429 || message.includes('rate limit')) {
    return new NetworkError(
      'Too many requests. Please wait a moment and try again.',
      ERROR_CODES.RATE_LIMITED,
      statusCode,
      true
    );
  }

  // Timeout errors
  if (message.includes('timeout') || statusCode === 408) {
    return new NetworkError(
      'Request timed out. Please try again.',
      ERROR_CODES.REQUEST_TIMEOUT,
      statusCode,
      true
    );
  }

  // Validation errors
  if (statusCode === 400 || message.includes('invalid') || message.includes('validation')) {
    return new ValidationError(message, undefined, { originalError: error });
  }

  // Solana-specific errors
  if (message.includes('wallet') || message.includes('Wallet')) {
    return new SolanaError(
      'Wallet connection error. Please check your wallet and try again.',
      ERROR_CODES.WALLET_NOT_CONNECTED,
      false
    );
  }

  if (message.includes('insufficient') || message.includes('balance')) {
    return new SolanaError(
      'Insufficient SOL balance. Please add more SOL to your wallet.',
      ERROR_CODES.INSUFFICIENT_FUNDS,
      false
    );
  }

  if (message.includes('transaction') || message.includes('signature')) {
    return new SolanaError(
      'Transaction failed. Please try again.',
      ERROR_CODES.TRANSACTION_FAILED,
      true
    );
  }

  // Unauthorized
  if (statusCode === 401 || statusCode === 403) {
    return new NetworkError(
      'Unauthorized access. Please check your permissions.',
      ERROR_CODES.UNAUTHORIZED,
      statusCode,
      false
    );
  }

  // Not found
  if (statusCode === 404) {
    return new NetworkError(
      'Resource not found.',
      ERROR_CODES.RESOURCE_NOT_FOUND,
      statusCode,
      false
    );
  }

  // Default to network error
  return new NetworkError(message, 'UNKNOWN_ERROR', statusCode, true);
}

// Error handling utilities
export function handleError(error: any, context?: string): void {
  const parsedError = parseError(error);
  
  console.error(`Error${context ? ` in ${context}` : ''}:`, {
    name: parsedError.name,
    message: parsedError.message,
    code: parsedError.code,
    statusCode: parsedError.statusCode,
    retryable: parsedError.retryable,
    details: parsedError.details,
    stack: parsedError.stack,
  });

  // Show user-friendly toast notification
  toast({
    title: getErrorTitle(parsedError),
    description: getUserFriendlyMessage(parsedError),
    variant: "destructive",
  });
}

export function getErrorTitle(error: AppError): string {
  switch (error.code) {
    case ERROR_CODES.NETWORK_UNAVAILABLE:
      return 'Connection Error';
    case ERROR_CODES.REQUEST_TIMEOUT:
      return 'Request Timeout';
    case ERROR_CODES.RATE_LIMITED:
      return 'Rate Limited';
    case ERROR_CODES.INVALID_INPUT:
      return 'Invalid Input';
    case ERROR_CODES.WALLET_NOT_CONNECTED:
      return 'Wallet Error';
    case ERROR_CODES.INSUFFICIENT_FUNDS:
      return 'Insufficient Funds';
    case ERROR_CODES.TRANSACTION_FAILED:
      return 'Transaction Failed';
    case ERROR_CODES.TOKEN_EXISTS:
      return 'Token Already Exists';
    case ERROR_CODES.UNAUTHORIZED:
      return 'Unauthorized';
    case ERROR_CODES.RESOURCE_NOT_FOUND:
      return 'Not Found';
    default:
      return 'Error';
  }
}

export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case ERROR_CODES.NETWORK_UNAVAILABLE:
      return 'Please check your internet connection and try again.';
    case ERROR_CODES.REQUEST_TIMEOUT:
      return 'The request took too long. Please try again.';
    case ERROR_CODES.RATE_LIMITED:
      return 'Too many requests. Please wait a moment before trying again.';
    case ERROR_CODES.WALLET_NOT_CONNECTED:
      return 'Please connect your wallet and try again.';
    case ERROR_CODES.INSUFFICIENT_FUNDS:
      return 'You need more SOL to complete this transaction.';
    case ERROR_CODES.TRANSACTION_FAILED:
      return 'The transaction could not be completed. Please try again.';
    case ERROR_CODES.TOKEN_EXISTS:
      return 'A token with this configuration already exists.';
    case ERROR_CODES.UNAUTHORIZED:
      return 'You do not have permission to perform this action.';
    case ERROR_CODES.RESOURCE_NOT_FOUND:
      return 'The requested resource could not be found.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

// Retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  backoff: boolean = true
): Promise<T> {
  let lastError: AppError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = parseError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        throw lastError;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with optional exponential backoff
      const currentDelay = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      
      console.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }

  throw lastError!;
}

// Error boundary HOC for React components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) {
  return function ErrorBoundaryWrapper(props: P) {
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
      setError(null);
    }, [props]);

    const retry = React.useCallback(() => {
      setError(null);
    }, []);

    if (error) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent error={error} retry={retry} />;
      }

      return (
        <div className="error-boundary p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
          <p className="text-red-700 mb-4">{error.message}</p>
          <button
            onClick={retry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    try {
      return <Component {...props} />;
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  };
}

// Global error handler for unhandled promises
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const error = parseError(event.reason);
    
    if (error.retryable) {
      toast({
        title: getErrorTitle(error),
        description: getUserFriendlyMessage(error),
        variant: "destructive",
      });
    }
  });
}

// Usage examples and utilities
export const createErrorHandler = (context: string) => {
  return (error: any) => handleError(error, context);
};

export const isRetryableError = (error: any): boolean => {
  const parsedError = parseError(error);
  return parsedError.retryable;
};

export const logError = (error: any, context?: string) => {
  const parsedError = parseError(error);
  
  // In production, this would send to a logging service
  console.error(`[${context || 'Unknown'}] ${parsedError.name}: ${parsedError.message}`, {
    code: parsedError.code,
    statusCode: parsedError.statusCode,
    details: parsedError.details,
    stack: parsedError.stack,
    timestamp: new Date().toISOString(),
  });
};
