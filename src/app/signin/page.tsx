import type { Metadata } from "next";
import { Ambient } from "@/components/shell/Ambient";
import { Mark } from "@/components/shell/Mark";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Enter" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; farewell?: string }> }) {
  const { next, farewell } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-16">
      <Ambient world="midnight-library" />
      <div className="relative z-10 w-full max-w-sm rise">
        <div className="mb-12 flex flex-col items-center text-center">
          <Mark size={44} />
          <h1 className="display mt-8 text-[44px] leading-none">The Inner World</h1>
          <p className="mt-4 font-serif text-[17px] italic text-ink-soft">A private room. The light is on.</p>
        </div>
        {farewell && (
          <p role="status" className="mb-8 rounded-2xl border border-line p-4 text-center font-serif text-[15px] leading-relaxed text-ink-soft">
            {farewell === "data"
              ? "Everything you stored has been deleted. Your empty login remains until it is removed in the Supabase dashboard."
              : "Everything has been deleted, including your login. Thank you for spending time here."}
          </p>
        )}
        <SignInForm next={next ?? "/"} />
        <p className="mt-10 text-center text-[12px] leading-relaxed text-ink-faint">
          Private by default. No feeds, no followers, no tracking.
        </p>
      </div>
    </main>
  );
}
