import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

let client: Anthropic | null = null;

export function aiConfigured() {
  return Boolean(serverEnv.anthropicKey);
}

/** Server-side only. The API key never reaches the browser. */
export function claude() {
  if (!client) {
    client = new Anthropic({ apiKey: serverEnv.anthropicKey, maxRetries: 2 });
  }
  return client;
}

// Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

/** Extra request fields for refusal fallbacks, when the configured model supports them. */
export function fallbackOptions(model: string) {
  return FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const }
    : { betas: [] as Anthropic.Beta.AnthropicBeta[] };
}

/** A sentence a person can act on, for any API failure. */
export function describeAiError(error: unknown): { message: string; status: number } {
  if (error instanceof Anthropic.AuthenticationError) {
    return { message: "The Anthropic API key is missing or invalid. Check ANTHROPIC_API_KEY on the server.", status: 500 };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { message: "Claude is receiving too many requests right now. Try again in a minute.", status: 429 };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { message: "Claude could not process that request.", status: 400 };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { message: "Could not reach Claude. Check your connection and try again.", status: 503 };
  }
  if (error instanceof Anthropic.APIError) {
    return { message: "Claude is temporarily unavailable. Try again shortly.", status: 503 };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { message: "Stopped.", status: 499 };
  }
  return { message: "Something went wrong while talking to Claude.", status: 500 };
}
