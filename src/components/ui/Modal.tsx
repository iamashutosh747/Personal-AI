"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Native <dialog>: focus trapping, Esc and backdrop handling for free. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-[22px] border border-line bg-raised p-0 text-ink shadow-[0_40px_120px_-30px_rgb(0_0_0/0.8)] backdrop:bg-black/60 backdrop:backdrop-blur-[2px] open:animate-[rise_.35s_ease-out]",
        wide ? "max-w-2xl" : "max-w-lg",
        className,
      )}
    >
      {open && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 className="display text-[26px]">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-full p-2 text-ink-faint hover:bg-sunken hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
