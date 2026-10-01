import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { Ambient } from "@/components/shell/Ambient";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const { user, profile } = await getViewer();
  if (!user || !profile) redirect("/signin");
  return (
    <main className="relative min-h-dvh">
      <Ambient world={profile.ambient_world} />
      <Onboarding profile={profile} />
    </main>
  );
}
