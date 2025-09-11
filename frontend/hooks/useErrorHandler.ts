import { useCallback } from 'react';
import { handleError, createErrorHandler } from '../utils/error-handling';

export function useErrorHandler(context?: string) {
  const errorHandler = useCallback(
    (error: any) => {
      handleError(error, context);
    },
    [context]
  );

  return errorHandler;
}

export function useContextualErrorHandler(context: string) {
  return useCallback(createErrorHandler(context), [context]);
}

// Hook for handling async operations with error handling
export function useAsyncOperation<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  context?: string
) {
  const handleError = useErrorHandler(context);

  return useCallback(
    async (...args: T): Promise<R | undefined> => {
      try {
        return await operation(...args);
      } catch (error) {
        handleError(error);
        return undefined;
      }
    },
    [operation, handleError]
  );
}
