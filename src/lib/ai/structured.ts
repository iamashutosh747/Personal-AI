import "server-only";
import type { z } from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, fallbackOptions } from "./client";
import { serverEnv } from "@/lib/env";

/**
 * One request that must come back as JSON matching `schema` (structured
 * outputs). Used for observations and suggestions, never for the person's
 * own words.
 */
export async function askStructured<S extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: S;
  effort?: "low" | "medium" | "high";
}): Promise<{ data: z.infer<S> | null; model: string; stopReason: string | null }> {
  const model = serverEnv.claudeModel;
  const res = await claude().beta.messages.parse({
    model,
    max_tokens: 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort ?? serverEnv.claudeEffort },
    ...fallbackOptions(model),
  });
  if (res.stop_reason === "refusal") return { data: null, model: res.model, stopReason: res.stop_reason };
  return { data: (res.parsed_output as z.infer<S> | null) ?? null, model: res.model, stopReason: res.stop_reason };
}

export function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
