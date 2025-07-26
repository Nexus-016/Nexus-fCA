"use strict";

/**
 * Nexus-FCA Enhanced Error Handling System
 * Provides comprehensive error management, recovery, and reporting
 */

const EventEmitter = require('events');
const logger = require('../logger');

class ErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableRetry: options.enableRetry !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      enableFallback: options.enableFallback !== false,
      enableReporting: options.enableReporting !== false,
      ...options
    };

    this.errorCounts = new Map();
    this.circuitBreakers = new Map();
    this.fallbackStrategies = new Map();
  }

  /**
   * Custom Error Classes
   */
  static get ErrorTypes() {
    return {
      NetworkError: class extends Error {
        constructor(message, statusCode = null) {
          super(message);
          this.name = 'NetworkError';
          this.statusCode = statusCode;
          this.retryable = true;
        }
      },
      
      AuthenticationError: class extends Error {
        constructor(message) {
          super(message);
          this.name = 'AuthenticationError';
          this.retryable = false;
        }
      },
      
      RateLimitError: class extends Error {
        constructor(message, retryAfter = null) {
          super(message);
          this.name = 'RateLimitError';
          this.retryAfter = retryAfter;
          this.retryable = true;
        }
      },
      
      ValidationError: class extends Error {
        constructor(message, field = null) {
          super(message);
          this.name = 'ValidationError';
          this.field = field;
          this.retryable = false;
        }
      },
      
      FacebookError: class extends Error {
        constructor(message, errorCode = null) {
          super(message);
          this.name = 'FacebookError';
          this.errorCode = errorCode;
          this.retryable = this.isRetryable(errorCode);
        }
        
        isRetryable(code) {
          const retryableCodes = [1, 2, 4, 17, 341, 368];
          return retryableCodes.includes(code);
        }
      }
    };
  }

  /**
   * Enhanced error wrapper with retry logic
   */
  async wrapWithRetry(fn, context = 'unknown', options = {}) {
    const {
      maxRetries = this.options.maxRetries,
      retryDelay = this.options.retryDelay,
      enableFallback = this.options.enableFallback
    } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const result = await fn();
        
        // Reset error count on success
        this.errorCounts.delete(context);
        return result;
        
      } catch (error) {
        lastError = this.enrichError(error, context, attempt);
        attempt++;

        // Track error frequency
        this.trackError(context, error);

        // Check circuit breaker
        if (this.isCircuitOpen(context)) {
          throw new ErrorHandler.ErrorTypes.NetworkError(
            `Circuit breaker open for ${context}. Too many failures.`
          );
        }

        // Don't retry non-retryable errors
        if (!this.isRetryable(error)) {
          break;
        }

        // Don't retry on last attempt
        if (attempt <= maxRetries) {
          await this.delay(this.calculateRetryDelay(attempt, retryDelay, error));
          logger(`Retrying ${context} (attempt ${attempt}/${maxRetries})`, 'warn');
        }
      }
    }

    // Try fallback strategy
    if (enableFallback && this.fallbackStrategies.has(context)) {
      try {
        logger(`Attempting fallback for ${context}`, 'info');
        return await this.fallbackStrategies.get(context)(lastError);
      } catch (fallbackError) {
        logger(`Fallback failed for ${context}: ${fallbackError.message}`, 'error');
      }
    }

    throw lastError;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  enrichError(error, context, attempt) {
    error.context = context;
    error.attempt = attempt;
    error.timestamp = new Date().toISOString();
    return error;
  }

  trackError(context, error) {
    const current = this.errorCounts.get(context) || { count: 0, lastError: Date.now() };
    current.count++;
    current.lastError = Date.now();
    this.errorCounts.set(context, current);

    if (current.count >= 5) {
      this.openCircuit(context);
    }
  }

  openCircuit(context) {
    this.circuitBreakers.set(context, {
      open: true,
      openedAt: Date.now(),
      resetTimeout: 30000
    });
    logger(`Circuit breaker opened for ${context}`, 'warn');
  }

  isCircuitOpen(context) {
    const breaker = this.circuitBreakers.get(context);
    if (!breaker || !breaker.open) return false;

    if (Date.now() - breaker.openedAt > breaker.resetTimeout) {
      this.circuitBreakers.delete(context);
      this.errorCounts.delete(context);
      return false;
    }
    return true;
  }

  isRetryable(error) {
    if (error.retryable !== undefined) return error.retryable;
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    if (error.statusCode) {
      const retryableStatusCodes = [429, 500, 502, 503, 504];
      return retryableStatusCodes.includes(error.statusCode);
    }
    return false;
  }

  calculateRetryDelay(attempt, baseDelay, error) {
    let delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    delay += jitter;
    
    if (error.retryAfter) {
      delay = Math.max(delay, error.retryAfter * 1000);
    }
    
    return Math.min(delay, 30000);
  }

  registerFallback(context, fallbackFn) {
    this.fallbackStrategies.set(context, fallbackFn);
  }

  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async safeExecute(fn, defaultValue = null, context = 'unknown') {
    try {
      return await this.wrapWithRetry(fn, context);
    } catch (error) {
      logger(`Safe execution failed for ${context}: ${error.message}`, 'error');
      return defaultValue;
    }
  }
}

module.exports = ErrorHandler;

/**
 * Custom error classes for different error types
 */
class NexusError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', recoverable = false) {
        super(message);
        this.name = 'NexusError';
        this.code = code;
        this.recoverable = recoverable;
        this.timestamp = new Date().toISOString();
    }
}

class LoginError extends NexusError {
    constructor(message, code = 'LOGIN_FAILED') {
        super(message, code, false);
        this.name = 'LoginError';
    }
}

class NetworkError extends NexusError {
    constructor(message, code = 'NETWORK_ERROR') {
        super(message, code, true);
        this.name = 'NetworkError';
    }
}

class ValidationError extends NexusError {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message, code, false);
        this.name = 'ValidationError';
    }
}

class RateLimitError extends NexusError {
    constructor(message, code = 'RATE_LIMITED') {
        super(message, code, true);
        this.name = 'RateLimitError';
        this.retryAfter = 60; // seconds
    }
}

/**
 * Create singleton instance
 */
const errorHandler = new ErrorHandler();

/**
 * Global error handling wrapper
 */
function wrapWithErrorHandling(fn, context = {}) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            const result = await errorHandler.handleError(error, context);
            
            // If recovery was attempted and failed, throw processed error
            if (result.recovery && !result.recovery.success && !result.recovery.retry) {
                throw result.error;
            }
            
            // If recovery suggests retry, increment retry count and rethrow
            if (result.recovery && result.recovery.retry) {
                error.retryCount = (error.retryCount || 0) + 1;
                if (error.retryCount > 3) {
                    throw new NexusError('Max retry attempts exceeded', 'MAX_RETRIES_EXCEEDED');
                }
                throw error;
            }
            
            throw result.error;
        }
    };
}

module.exports = {
    ErrorHandler,
    errorHandler,
    wrapWithErrorHandling
};
