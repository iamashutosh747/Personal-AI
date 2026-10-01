import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block">
      <span className="eyebrow">{children}</span>
      {hint && <span className="ml-2 text-[12px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "field w-full border-b border-line-strong bg-transparent py-2.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-accent",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "field w-full resize-none border-b border-line-strong bg-transparent py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint transition-colors focus:border-accent",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "field w-full appearance-none border-b border-line-strong bg-transparent py-2.5 text-[15px] text-ink focus:border-accent [&>option]:bg-raised",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  name,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  description?: string;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-6 py-3", disabled && "opacity-50")}>
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-faint">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          name={name}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full border border-line-strong bg-sunken transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:outline peer-focus-visible:outline-accent" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-ink-faint transition-all peer-checked:translate-x-5 peer-checked:bg-accent" />
      </span>
    </label>
  );
}
