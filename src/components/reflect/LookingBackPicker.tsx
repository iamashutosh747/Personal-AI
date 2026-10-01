import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/time";
import { EmptyState } from "@/components/ui/EmptyState";

export function LookingBackPicker({ entries }: { entries: { id: string; title: string | null; body: string; created_at: string }[] }) {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 sm:px-8">
      <Link href="/reflect" className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft">
        <ArrowLeft size={14} /> Reflection Room
      </Link>
      <p className="eyebrow mt-10">Looking Back</p>
      <h1 className="display mt-3 text-[44px]">Which page will you return to?</h1>
      {entries.length === 0 ? (
        <EmptyState title="Not yet">Looking Back opens once you have entries at least two weeks old.</EmptyState>
      ) : (
        <>
          <Link
            href={`/reflect/write?mode=looking_back&revisit=${entries[Math.floor(Math.random() * entries.length)]!.id}`}
            className="mt-6 inline-block text-[14px] text-accent hover:underline"
          >
            Let chance choose →
          </Link>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {entries.map((e) => (
              <li key={e.id}>
                <Link href={`/reflect/write?mode=looking_back&revisit=${e.id}`} className="group block py-4">
                  <p className="text-[12px] text-ink-faint">{formatDate(e.created_at)}</p>
                  <p className="mt-1 line-clamp-2 font-serif text-[16px] text-ink-soft group-hover:text-ink">{e.title ?? e.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
