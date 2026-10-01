import Link from "next/link";
import { requireViewer } from "@/lib/data";
import { createCapsuleDraft } from "@/lib/actions/capsules";
import { CAPSULE_COLUMNS, type Capsule } from "@/lib/types";
import { formatDate, nowMs } from "@/lib/time";
import { Page, PageHeader } from "@/components/ui/Page";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Seal } from "@/components/capsules/Seal";

export const metadata = { title: "Time Capsules" };

function until(iso: string) {
  const days = Math.ceil((Date.parse(iso) - nowMs()) / 86400000);
  if (days <= 1) return "tomorrow";
  if (days < 60) return `in ${days} days`;
  if (days < 730) return `in ${Math.round(days / 30)} months`;
  return `in ${Math.round(days / 365)} years`;
}

export default async function CapsulesPage() {
  const { supabase } = await requireViewer();
  const { data } = await supabase.from("capsules").select(CAPSULE_COLUMNS).order("open_at").returns<Capsule[]>();
  const all = data ?? [];
  const now = nowMs();
  const drafts = all.filter((c) => !c.sealed_at);
  const ready = all.filter((c) => c.sealed_at && !c.opened_at && Date.parse(c.open_at) <= now);
  const sealed = all.filter((c) => c.sealed_at && Date.parse(c.open_at) > now);
  const opened = all.filter((c) => c.opened_at).reverse();

  return (
    <Page>
      <PageHeader
        eyebrow="Time Capsules"
        title="Letters to later"
        actions={
          <form action={createCapsuleDraft}>
            <Button variant="primary" type="submit">
              Write a letter
            </Button>
          </form>
        }
      >
        Write to the person you’ll be. Once sealed, a letter can’t be read or changed, not even by you, until its day comes. When it opens, it
        reads exactly as you wrote it.
      </PageHeader>

      {all.length === 0 && (
        <EmptyState title="Nothing sealed yet" glyph={<Seal size={64} />}>
          A capsule can hold a letter, a voice note, photographs, the goals you’re holding now, and memories you want to send forward.
        </EmptyState>
      )}

      {ready.length > 0 && (
        <section className="mb-16">
          <h2 className="eyebrow mb-4 !text-accent">Ready to open</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {ready.map((c) => (
              <Link key={c.id} href={`/capsules/${c.id}`} className="group flex items-center gap-5 rounded-3xl border border-accent/40 bg-accent-soft p-6 transition-colors hover:border-accent">
                <Seal size={64} />
                <span>
                  <span className="display block text-[26px] leading-tight">{c.title}</span>
                  <span className="mt-1 block text-[13px] text-ink-soft">Sealed {formatDate(c.sealed_at)} · its day has come</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {sealed.length > 0 && (
        <section className="mb-16">
          <h2 className="eyebrow mb-4">Sealed</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sealed.map((c) => (
              <li key={c.id}>
                <Link href={`/capsules/${c.id}`} className="group block rounded-3xl border border-line bg-raised/40 p-6 transition-colors hover:border-line-strong">
                  <div className="flex items-start justify-between">
                    <Seal size={46} />
                    <span className="text-[12px] text-ink-faint">opens {until(c.open_at)}</span>
                  </div>
                  <p className="display mt-5 text-[24px] leading-tight">{c.title}</p>
                  <p className="mt-1 text-[12.5px] text-ink-faint">
                    Sealed {formatDate(c.sealed_at)} · opens {formatDate(c.open_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <section className="mb-16">
          <h2 className="eyebrow mb-4">Unsealed drafts</h2>
          <ul className="divide-y divide-line border-y border-line">
            {drafts.map((c) => (
              <li key={c.id}>
                <Link href={`/capsules/${c.id}`} className="flex items-baseline justify-between py-4 hover:text-accent">
                  <span className="font-display text-[21px]">{c.title}</span>
                  <span className="text-[12px] text-ink-faint">draft</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {opened.length > 0 && (
        <section>
          <h2 className="eyebrow mb-4">Opened</h2>
          <ul className="divide-y divide-line border-y border-line">
            {opened.map((c) => (
              <li key={c.id}>
                <Link href={`/capsules/${c.id}`} className="flex items-baseline justify-between gap-4 py-4 hover:text-accent">
                  <span className="font-display text-[21px]">{c.title}</span>
                  <span className="text-[12px] text-ink-faint">
                    written {formatDate(c.sealed_at)} · opened {formatDate(c.opened_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
