import { z } from "zod";
import { ATTRIBUTE_KINDS, CONVERSATION_STYLES, JOURNAL_MODES, MEMORY_KINDS, WORLDS } from "./types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export function parseTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  const seen = new Set<string>();
  for (const t of list) {
    const tag = String(t).trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").slice(0, 40);
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, 20);
}

export const memoryInput = z.object({
  kind: z.enum(MEMORY_KINDS).default("reflection"),
  title: z.string().trim().min(1, "Give it a title").max(200),
  body: z.string().max(20000).default(""),
  occurred_on: isoDate,
  location: optionalText(200),
  category: optionalText(60),
  tags: z.array(z.string()).default([]),
  ai_access: z.boolean().default(true),
});
export type MemoryInput = z.infer<typeof memoryInput>;

export const journalInput = z.object({
  mode: z.enum(JOURNAL_MODES).default("unfiltered"),
  title: optionalText(200),
  body: z.string().max(100000).default(""),
  mood: optionalText(40),
  prompt: optionalText(500),
  ai_access: z.boolean().default(false),
  revisits_id: z.string().uuid().nullable().optional(),
});

export const profileInput = z.object({
  display_name: optionalText(80),
  space_name: z.string().trim().min(1).max(80).optional(),
  conversation_style: z.enum(CONVERSATION_STYLES).optional(),
  modules: z.array(z.string()).optional(),
  ambient_world: z.enum(WORLDS).optional(),
  auto_world: z.boolean().optional(),
  motion: z.boolean().optional(),
  sound: z.boolean().optional(),
  default_ai_access: z.boolean().optional(),
  journal_ai_access: z.boolean().optional(),
  never_share_tags: z.array(z.string()).optional(),
  rediscovery_frequency: z.enum(["daily", "weekly", "off"]).optional(),
  rediscovery_kinds: z.array(z.string()).optional(),
  timezone: z.string().max(64).optional(),
});

export const attributeInput = z.object({
  kind: z.enum(ATTRIBUTE_KINDS),
  label: z.string().trim().min(1).max(200),
  detail: optionalText(2000),
  rank: z.coerce.number().int().min(1).max(99).nullable().optional(),
  since: isoDate,
});

export const capsuleInput = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  letter: z.string().max(50000).default(""),
  open_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  tz_offset_minutes: z.coerce.number().int().min(-900).max(900).default(0),
  memory_ids: z.array(z.string().uuid()).default([]),
  goals: z.array(z.string().trim().max(300)).default([]),
});

export const uuid = z.string().uuid();
