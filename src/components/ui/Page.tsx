import { cn } from "@/lib/cn";

export function Page({ children, className, narrow }: { children: React.ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cn("mx-auto w-full px-5 sm:px-8", narrow ? "max-w-3xl" : "max-w-6xl", className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="rise flex flex-col gap-6 pb-10 pt-8 sm:flex-row sm:items-end sm:justify-between sm:pt-14">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h1 className="display text-[44px] sm:text-[60px]">{title}</h1>
        {children && <div className="mt-4 font-serif text-[18px] leading-relaxed text-ink-soft">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
