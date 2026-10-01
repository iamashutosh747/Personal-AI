import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { DAILY_RESET_PROMPTS, DEEP_PROMPTS, promptForDate } from "@/lib/prompts";
import { isoDaysAgo, pickOne, todayIn } from "@/lib/time";
import { JOURNAL_MODES, type JournalEntry, type JournalMode } from "@/lib/types";
import { JournalEditor } from "@/components/reflect/JournalEditor";
import { LookingBackPicker } from "@/components/reflect/LookingBackPicker";

export const metadata = { title: "Write" };

export default async function WritePage({ searchParams }: { searchParams: Promise<{ mode?: string; prompt?: string; revisit?: string }> }) {
  const sp = await searchParams;
  const mode: JournalMode = (JOURNAL_MODES as readonly string[]).includes(sp.mode ?? "") ? (sp.mode as JournalMode) : "unfiltered";
  const { supabase, profile } = await requireViewer();

  if (mode === "looking_back") {
    if (!sp.revisit) {
      const { data: older } = await supabase
        .from("journal_entries")
        .select("id,title,body,created_at,mode")
        .lt("created_at", isoDaysAgo(14))
        .order("created_at", { ascending: false })
        .limit(60);
      return <LookingBackPicker entries={older ?? []} />;
    }
    let revisitId = sp.revisit;
    if (revisitId === "random") {
      // "Let chance choose": any entry at least two weeks old.
      const { data: ids } = await supabase.from("journal_entries").select("id").lt("created_at", isoDaysAgo(14)).limit(500);
      revisitId = pickOne(ids ?? [])?.id ?? "";
    }
    if (!/^[0-9a-f-]{36}$/i.test(revisitId)) redirect("/reflect/write?mode=looking_back");
    const { data: revisit } = await supabase.from("journal_entries").select("id,title,body,created_at").eq("id", revisitId).maybeSingle<Pick<JournalEntry, "id" | "title" | "body" | "created_at">>();
    return <JournalEditor mode={mode} prompts={[]} revisit={revisit} />;
  }

  const prompts =
    sp.prompt === "today"
      ? [promptForDate(todayIn(profile.timezone))]
      : mode === "daily_reset"
        ? DAILY_RESET_PROMPTS
        : mode === "deep"
          ? [DEEP_PROMPTS[Number(todayIn(profile.timezone).slice(8)) % DEEP_PROMPTS.length]!]
          : [];
  return <JournalEditor mode={mode} prompts={prompts} />;
}
