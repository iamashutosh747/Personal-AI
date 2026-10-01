import { Ambient } from "@/components/shell/Ambient";
import { Mark } from "@/components/shell/Mark";

export const metadata = { title: "Setup needed" };

export default function SetupPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6">
      <Ambient world="midnight-library" />
      <div className="relative z-10 max-w-lg">
        <Mark size={40} />
        <h1 className="display mt-6 text-[40px]">Almost there</h1>
        <p className="mt-4 font-serif text-[18px] leading-relaxed text-ink-soft">
          The Inner World needs a Supabase project to keep your data. Copy <code className="text-accent">.env.example</code>{" "}
          to <code className="text-accent">.env.local</code>, fill in your project URL and anon key, then restart the server.
          The README walks through it step by step.
        </p>
      </div>
    </main>
  );
}
