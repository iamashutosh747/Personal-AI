import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "quiet" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:brightness-110 active:brightness-95 shadow-[0_0_0_1px_rgb(0_0_0/0.2),0_8px_30px_-12px_var(--accent)]",
  quiet: "bg-raised text-ink border border-line hover:border-line-strong",
  ghost: "text-ink-soft hover:text-ink hover:bg-raised",
  danger: "text-danger border border-danger/40 hover:bg-danger/10",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
>(function Button({ variant = "quiet", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,color,border,filter] duration-200 disabled:opacity-40 disabled:pointer-events-none select-none",
        size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-11 px-5 text-[14px]",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
