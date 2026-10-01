// Row shapes for the tables in supabase/migrations. Kept by hand and small on
// purpose; if the schema grows, generate them with `supabase gen types`.

export const MEMORY_KINDS = [
  "reflection",
  "event",
  "experience",
  "idea",
  "goal",
  "relationship",
  "favorite",
  "place",
  "photo",
  "future_message",
  "preference",
  "lesson",
  "other",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  reflection: "Reflection",
  event: "Life event",
  experience: "Experience",
  idea: "Idea or realization",
  goal: "Goal or ambition",
  relationship: "Relationship",
  favorite: "Favorite work",
  place: "Place",
  photo: "Photograph",
  future_message: "Note to future self",
  preference: "Preference",
  lesson: "Lesson learned",
  other: "Other",
};

export const WORLDS = [
  "midnight-library",
  "rainy-window",
  "quiet-observatory",
  "golden-hour",
  "deep-forest",
  "monochrome",
] as const;
export type World = (typeof WORLDS)[number];

export const WORLD_LABELS: Record<World, { name: string; note: string }> = {
  "midnight-library": { name: "Midnight Library", note: "Ink, graphite and one warm lamp." },
  "rainy-window": { name: "Rainy Window", note: "Soft blue haze and quiet rain." },
  "quiet-observatory": { name: "Quiet Observatory", note: "Deep navy and slow stars." },
  "golden-hour": { name: "Golden Hour", note: "Late sun on warm stone." },
  "deep-forest": { name: "Deep Forest", note: "Moss, shade and still air." },
  monochrome: { name: "Monochrome", note: "Nothing but type and space." },
};

export const CONVERSATION_STYLES = ["balanced", "concise", "expansive", "socratic", "playful"] as const;
export type ConversationStyle = (typeof CONVERSATION_STYLES)[number];
export const CONVERSATION_STYLE_LABELS: Record<ConversationStyle, string> = {
  balanced: "Balanced — thoughtful, as long as it needs to be",
  concise: "Concise — brief and direct",
  expansive: "Expansive — room to explore ideas fully",
  socratic: "Socratic — more questions, fewer answers",
  playful: "Playful — lighter, with humor where it fits",
};

export const JOURNAL_MODES = ["daily_reset", "deep", "unfiltered", "looking_back"] as const;
export type JournalMode = (typeof JOURNAL_MODES)[number];
export const JOURNAL_MODE_LABELS: Record<JournalMode, { name: string; note: string }> = {
  daily_reset: { name: "Daily Reset", note: "How the day went, what mattered, what to carry forward." },
  deep: { name: "Deep Reflection", note: "Think something through, with a companion if you want one." },
  unfiltered: { name: "Unfiltered", note: "Just you and the page. No AI, no prompts." },
  looking_back: { name: "Looking Back", note: "Revisit an earlier entry and notice what has changed." },
};

export const ATTRIBUTE_KINDS = ["value", "interest", "goal", "favorite", "milestone", "priority"] as const;
export type AttributeKind = (typeof ATTRIBUTE_KINDS)[number];
export const ATTRIBUTE_LABELS: Record<AttributeKind, string> = {
  value: "Values",
  interest: "Interests",
  goal: "Goals",
  favorite: "Favorites",
  milestone: "Milestones",
  priority: "Priorities",
};

export interface Profile {
  id: string;
  display_name: string | null;
  space_name: string;
  conversation_style: ConversationStyle;
  modules: string[];
  ambient_world: World;
  auto_world: boolean;
  motion: boolean;
  sound: boolean;
  default_ai_access: boolean;
  journal_ai_access: boolean;
  never_share_tags: string[];
  rediscovery_frequency: "daily" | "weekly" | "off";
  rediscovery_kinds: string[];
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  kind: MemoryKind;
  title: string;
  body: string;
  occurred_on: string | null;
  location: string | null;
  tags: string[];
  category: string | null;
  ai_access: boolean;
  pinned: boolean;
  source_type: "manual" | "conversation" | "journal" | "proposal" | "import" | "capture";
  source_id: string | null;
  source_excerpt: string | null;
  last_surfaced_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MEMORY_COLUMNS =
  "id,user_id,kind,title,body,occurred_on,location,tags,category,ai_access,pinned,source_type,source_id,source_excerpt,last_surfaced_at,created_at,updated_at";

export interface MemoryLink {
  id: string;
  from_id: string;
  to_id: string;
  origin: "manual" | "ai_suggested";
  status: "approved" | "suggested" | "rejected";
  note: string | null;
  created_at: string;
}

export interface Media {
  id: string;
  memory_id: string | null;
  capsule_id: string | null;
  journal_entry_id: string | null;
  kind: "image" | "audio";
  storage_path: string;
  mime: string;
  bytes: number;
  caption: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  mode: JournalMode;
  title: string | null;
  body: string;
  mood: string | null;
  prompt: string | null;
  ai_access: boolean;
  revisits_id: string | null;
  created_at: string;
  updated_at: string;
}

export const JOURNAL_COLUMNS = "id,mode,title,body,mood,prompt,ai_access,revisits_id,created_at,updated_at";

export interface Conversation {
  id: string;
  title: string;
  archived: boolean;
  memory_mode: "all" | "chosen" | "none";
  chosen_memory_ids: string[];
  ai_access: boolean;
  journal_entry_id: string | null;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  context_memory_ids: string[];
  context_entry_ids: string[];
  context_message_ids: string[];
  model: string | null;
  stop_reason: string | null;
  created_at: string;
}

export const MESSAGE_COLUMNS =
  "id,conversation_id,role,content,context_memory_ids,context_entry_ids,context_message_ids,model,stop_reason,created_at";

export interface MemoryProposal {
  id: string;
  action: "create" | "update" | "forget";
  target_memory_id: string | null;
  kind: MemoryKind | null;
  title: string | null;
  body: string | null;
  tags: string[];
  reason: string | null;
  source_type: "conversation" | "journal";
  source_id: string | null;
  source_excerpt: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
}

export interface ObservationSource {
  type: "memory" | "journal" | "message" | "attribute";
  id: string;
  excerpt: string;
}

export interface Observation {
  id: string;
  scope: "journal" | "mirror" | "weekly" | "monthly" | "entry";
  kind: "theme" | "priority_shift" | "pattern" | "summary" | "question" | "connection";
  label: "observation" | "hypothesis";
  statement: string;
  sources: ObservationSource[];
  status: "pending" | "accepted" | "rejected" | "corrected";
  correction: string | null;
  entry_id: string | null;
  period_start: string | null;
  period_end: string | null;
  model: string | null;
  created_at: string;
}

export interface SelfAttribute {
  id: string;
  kind: AttributeKind;
  label: string;
  detail: string | null;
  rank: number | null;
  since: string;
  until: string | null;
  origin: "self" | "observation";
  observation_id: string | null;
  ai_access: boolean;
  created_at: string;
}

export interface Capsule {
  id: string;
  title: string;
  open_at: string;
  sealed_at: string | null;
  opened_at: string | null;
  memory_ids: string[];
  goals: string[];
  created_at: string;
}

export const CAPSULE_COLUMNS = "id,title,open_at,sealed_at,opened_at,memory_ids,goals,created_at";

export interface RetrievedItem {
  source: "memory" | "journal" | "message";
  id: string;
  kind: string;
  title: string;
  body: string;
  occurred_on: string | null;
  created_at: string;
  tags: string[];
  score: number;
}
