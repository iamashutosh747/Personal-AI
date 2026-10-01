import { Mark } from "@/components/shell/Mark";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Mark size={44} />
      <h1 className="display mt-8 text-[40px]">You’re offline</h1>
      <p className="mt-4 max-w-sm font-serif text-[17px] leading-relaxed text-ink-soft">
        Your Inner World lives in your own database, so it needs a connection. Everything you wrote is safe. It will be here when you’re back.
      </p>
    </main>
  );
}
