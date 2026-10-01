// Central access to configuration. Server-only values are read lazily so a
// missing optional key never breaks pages that don't need it.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export const serverEnv = {
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get claudeModel() {
    return process.env.CLAUDE_MODEL || "claude-opus-5-5";
  },
  get claudeEffort(): "low" | "medium" | "high" {
    const v = process.env.CLAUDE_EFFORT;
    return v === "low" || v === "high" ? v : "medium";
  },
  get voyageKey() {
    return process.env.VOYAGE_API_KEY ?? "";
  },
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get allowedEmails(): string[] {
    return (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  get chatPerMinute() {
    return Number(process.env.AI_RATE_PER_MINUTE || 12);
  },
  get chatPerDay() {
    return Number(process.env.AI_RATE_PER_DAY || 400);
  },
};
