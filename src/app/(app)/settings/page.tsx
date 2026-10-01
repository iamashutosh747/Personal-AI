import { requireViewer } from "@/lib/data";
import { serverEnv } from "@/lib/env";
import { aiConfigured } from "@/lib/ai/client";
import { embeddingsEnabled } from "@/lib/memory/embeddings";
import { signOut } from "@/lib/actions/auth";
import { Page, PageHeader } from "@/components/ui/Page";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { DataControls } from "@/components/settings/DataControls";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, user } = await requireViewer();
  return (
    <Page narrow>
      <PageHeader eyebrow="Settings" title="Your space, your rules">
        Everything you chose during setup, and everything you didn’t. Changes save as you make them.
      </PageHeader>
      <SettingsForm profile={profile} />

      <section id="data" className="mt-20 scroll-mt-24">
        <h2 className="display text-[34px]">Your data</h2>
        <DataControls canRemoveLogin={Boolean(serverEnv.serviceRoleKey)} />
      </section>

      <section className="mt-20 border-t border-line pt-8">
        <h2 className="eyebrow">Status</h2>
        <dl className="mt-4 grid grid-cols-[180px_1fr] gap-y-2 text-[14px]">
          <dt className="text-ink-faint">Signed in as</dt>
          <dd>{user.email}</dd>
          <dt className="text-ink-faint">Claude</dt>
          <dd>{aiConfigured() ? `Connected · ${serverEnv.claudeModel} · ${serverEnv.claudeEffort} effort` : "Not connected (ANTHROPIC_API_KEY is not set)"}</dd>
          <dt className="text-ink-faint">Memory search</dt>
          <dd>{embeddingsEnabled() ? "Full-text + semantic (Voyage AI)" : "Full-text, inside your database"}</dd>
          <dt className="text-ink-faint">Time zone</dt>
          <dd>{profile.timezone}</dd>
        </dl>
        <form action={signOut} className="mt-8">
          <button className="text-[14px] text-ink-faint hover:text-ink">Sign out</button>
        </form>
      </section>
    </Page>
  );
}
