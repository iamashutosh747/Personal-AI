"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const PHRASE = "delete everything";

export function DataControls({ canRemoveLogin }: { canRemoveLogin: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: PHRASE }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string; accountRemoved?: boolean };
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    window.location.href = json.accountRemoved ? "/signin?farewell=1" : "/signin?farewell=data";
  }

  return (
    <div className="mt-6 space-y-10">
      <div>
        <h3 className="text-[16px] text-ink">Export</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-faint">
          Everything you’ve stored: memories, journal, conversations, Mirror, capsules (including sealed letters, since they are yours),
          AI observations clearly marked, and every photo and recording.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/export" className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-[14px] hover:border-line-strong">
            <Download size={16} /> Download everything (.zip)
          </a>
          <a href="/api/export?format=json" className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] text-ink-faint hover:text-ink-soft">
            Text only (.json)
          </a>
        </div>
      </div>

      <div className="rounded-3xl border border-danger/30 p-6">
        <h3 className="text-[16px] text-danger">Delete everything</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-faint">
          Permanently removes every memory, entry, conversation, capsule, photo and recording.
          {canRemoveLogin ? " Your login is removed too." : " Your empty login will remain until you remove it in the Supabase dashboard (Authentication → Users)."} This cannot be
          undone. Export first if you might want any of it.
        </p>
        <Button variant="danger" className="mt-5" onClick={() => setOpen(true)}>
          Delete everything…
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="This is permanent">
        <p className="font-serif text-[16px] leading-relaxed text-ink-soft">
          Type <span className="text-ink">{PHRASE}</span> to confirm.
        </p>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation" autoFocus className="field mt-4 w-full border-b border-line-strong bg-transparent py-2 text-[15px] focus:border-danger" />
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={typed.trim().toLowerCase() !== PHRASE || busy} onClick={destroy}>
            {busy ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
