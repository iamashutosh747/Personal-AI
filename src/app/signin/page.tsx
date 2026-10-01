import type { Metadata } from "next";
import { Ambient } from "@/components/shell/Ambient";
import { Mark } from "@/components/shell/Mark";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Enter" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-16">
      <Ambient world="midnight-library" />
      <div className="relative z-10 w-full max-w-sm rise">
        <div className="mb-12 flex flex-col items-center text-center">
          <Mark size={44} />
          <h1 className="display mt-8 text-[44px] leading-none">The Inner World</h1>
          <p className="mt-4 font-serif text-[17px] italic text-ink-soft">A private room. The light is on.</p>
        </div>
        <SignInForm next={next ?? "/"} />
        <p className="mt-10 text-center text-[12px] leading-relaxed text-ink-faint">
          Private by default. No feeds, no followers, no tracking.
        </p>
      </div>
    </main>
  );
}
