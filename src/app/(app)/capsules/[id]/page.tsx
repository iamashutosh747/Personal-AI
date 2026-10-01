import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/data";
import { CAPSULE_COLUMNS, type Capsule, type Media } from "@/lib/types";
import { formatDate, isPast } from "@/lib/time";
import { Page } from "@/components/ui/Page";
import { Seal } from "@/components/capsules/Seal";
import { CapsuleDraft } from "@/components/capsules/CapsuleDraft";
import { CapsuleLetter, CapsuleOpening } from "@/components/capsules/CapsuleOpening";
import { DeleteCapsule } from "@/components/capsules/DeleteCapsule";

export const metadata = { title: "Time Capsule" };

export default async function CapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireViewer();
  const { data: capsule } = await supabase.from("capsules").select(CAPSULE_COLUMNS).eq("id", id).maybeSingle<Capsule>();
  if (!capsule) notFound();

  const due = isPast(capsule.open_at);
  const back = (
    <Link href="/capsules" className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft">
      <ArrowLeft size={14} /> Time Capsules
    </Link>
  );

  // Draft: fully editable.
  if (!capsule.sealed_at) {
    const [{ data: draft }, { data: media }, { data: memories }] = await Promise.all([
      supabase.rpc("read_capsule", { p_id: id }).single<{ letter: string }>(),
      supabase.from("media").select("*").eq("capsule_id", id).order("created_at").returns<Media[]>(),
      supabase.from("memories").select("id,title").order("created_at", { ascending: false }).limit(300),
    ]);
    return (
      <Page narrow>
        {back}
        <CapsuleDraft
          capsule={capsule}
          letter={draft?.letter ?? ""}
          media={media ?? []}
          memoryOptions={memories ?? []}
          displayName={profile.display_name}
        />
      </Page>
    );
  }

  // Sealed and waiting.
  if (!due) {
    return (
      <Page narrow>
        {back}
        <div className="flex flex-col items-center py-20 text-center">
          <Seal size={110} />
          <h1 className="display mt-10 text-[44px] leading-tight">{capsule.title}</h1>
          <p className="mt-4 font-serif text-[18px] text-ink-soft">
            Sealed on {formatDate(capsule.sealed_at)}. It opens on {formatDate(capsule.open_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
          </p>
          <p className="mt-2 text-[13px] text-ink-faint">Until then, nobody can read it: not you, not the AI, not the app.</p>
          <div className="mt-16">
            <DeleteCapsule id={capsule.id} sealed />
          </div>
        </div>
      </Page>
    );
  }

  const { data: media } = await supabase.from("media").select("*").eq("capsule_id", id).order("created_at").returns<Media[]>();
  const { data: memories } = capsule.memory_ids.length
    ? await supabase.from("memories").select("id,title").in("id", capsule.memory_ids)
    : { data: [] };

  // Due but never opened: the ceremony.
  if (!capsule.opened_at) {
    return (
      <Page narrow>
        {back}
        <CapsuleOpening capsule={capsule} media={media ?? []} memories={memories ?? []} />
      </Page>
    );
  }

  // Already opened: read it again, unchanged.
  const { data: letter } = await supabase.rpc("read_capsule", { p_id: id }).single<{ letter: string }>();
  return (
    <Page narrow>
      {back}
      <CapsuleLetter capsule={capsule} letter={letter?.letter ?? ""} media={media ?? []} memories={memories ?? []} />
    </Page>
  );
}
