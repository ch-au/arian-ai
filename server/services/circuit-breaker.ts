/**
 * Circuit Breaker and Retry Logic for LLM API Calls
 *
 * Provides resilience patterns for external API calls:
 * - Retry with exponential backoff
 * - Circuit breaker to prevent cascading failures
 * - Rate limit handling
 */

import {
  circuitBreaker,
  handleAll,
  ConsecutiveBreaker,
  ExponentialBackoff,
  retry,
  wrap,
  CircuitState,
} from "cockatiel";
import pino from "pino";

const log = pino({ name: "circuit-breaker" });

// ============================================================================
// Circuit Breaker Configuration
// ============================================================================

/**
 * Circuit breaker for LLM API calls
 * Opens after 5 consecutive failures, tries again after 30 seconds
 */
export const llmCircuitBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 30 * 1000, // Try again after 30 seconds
  breaker: new ConsecutiveBreaker(5), // Open after 5 consecutive failures
});

/**
 * Retry policy with exponential backoff for LLM calls
 * Max 3 attempts with delays: 1s, 2s, 4s (capped at 30s)
 */
export const llmRetryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({
    initialDelay: 1000,
    maxDelay: 30000,
    exponent: 2,
  }),
});

/**
 * Combined policy: retry with circuit breaker protection
 * First retries, then circuit breaker kicks in if failures persist
 */
export const llmPolicy = wrap(llmRetryPolicy, llmCircuitBreaker);

// ============================================================================
// Event Listeners for Monitoring
// ============================================================================

llmCircuitBreaker.onBreak(() => {
  log.warn("[CIRCUIT BREAKER] LLM circuit breaker OPENED - stopping requests");
});

llmCircuitBreaker.onHalfOpen(() => {
  log.info("[CIRCUIT BREAKER] LLM circuit breaker half-open, testing...");
});

llmCircuitBreaker.onReset(() => {
  log.info("[CIRCUIT BREAKER] LLM circuit breaker RESET - requests resumed");
});

llmCircuitBreaker.onStateChange((state) => {
  log.info({ state: CircuitState[state] }, "[CIRCUIT BREAKER] State changed");
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || "";
  const statusCode = error.status || error.statusCode || error.code;

  return (
    statusCode === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("quota exceeded")
  );
}

/**
 * Check if an error is a transient error that should be retried
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || "";
  const statusCode = error.status || error.statusCode || error.code;

  // Retry on rate limits, server errors, and network issues
  return (
    isRateLimitError(error) ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused")
  );
}

/**
 * Check if an error is a validation/permanent error that should NOT be retried
 */
export function isPermanentError(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || "";
  const statusCode = error.status || error.statusCode || error.code;

  return (
    statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 404 ||
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("not found") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  );
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(): {
  state: string;
  isOpen: boolean;
  isClosed: boolean;
  isHalfOpen: boolean;
} {
  const state = llmCircuitBreaker.state;
  return {
    state: CircuitState[state],
    isOpen: state === CircuitState.Open,
    isClosed: state === CircuitState.Closed,
    isHalfOpen: state === CircuitState.HalfOpen,
  };
}

// ============================================================================
// Execution Wrapper
// ============================================================================

/**
 * Execute a function with retry and circuit breaker protection
 *
 * @param fn - The async function to execute
 * @param context - Context for logging (e.g., { negotiationId, runId })
 * @returns The result of the function
 * @throws If all retries fail or circuit is open
 */
export async function executeWithResilience<T>(
  fn: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await llmPolicy.execute(async ({ attempt }) => {
      if (attempt > 1) {
        log.info(
          { ...context, attempt },
          `[RETRY] Attempt ${attempt} for LLM call`
        );
      }

      try {
        return await fn();
      } catch (error: any) {
        // Don't retry permanent errors
        if (isPermanentError(error)) {
          log.warn(
            { ...context, error: error.message },
            "[RETRY] Permanent error, not retrying"
          );
          throw error; // This will stop retries
        }

        // Log rate limits specially
        if (isRateLimitError(error)) {
          log.warn(
            { ...context, attempt },
            "[RETRY] Rate limited, will retry with backoff"
          );
        }

        throw error; // Allow retry for transient errors
      }
    });

    const duration = Date.now() - startTime;
    log.debug({ ...context, duration }, "[RESILIENCE] Call succeeded");

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    log.error(
      { ...context, duration, error: error.message },
      "[RESILIENCE] Call failed after all retries"
    );
    throw error;
  }
}

/**
 * Execute with custom retry options
 */
export async function executeWithCustomRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    context?: Record<string, any>;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    context = {},
  } = options;

  const customRetry = retry(handleAll, {
    maxAttempts,
    backoff: new ExponentialBackoff({
      initialDelay,
      maxDelay,
      exponent: 2,
    }),
  });

  const customPolicy = wrap(customRetry, llmCircuitBreaker);

  return customPolicy.execute(async ({ attempt }) => {
    if (attempt > 1) {
      log.info({ ...context, attempt }, `[CUSTOM RETRY] Attempt ${attempt}`);
    }
    return fn();
  });
}
