import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { Ambient } from "@/components/shell/Ambient";
import { Shell } from "@/components/shell/Shell";
import { hourIn, worldForHour } from "@/lib/time";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireViewer();
  if (!profile.onboarded_at) redirect("/welcome");

  const { count } = await supabase
    .from("memory_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const world = profile.auto_world ? worldForHour(hourIn(profile.timezone), profile.ambient_world) : profile.ambient_world;

  return (
    <>
      <Ambient world={world} />
      <Shell profile={profile} pendingProposals={count ?? 0}>
        {children}
      </Shell>
    </>
  );
}
