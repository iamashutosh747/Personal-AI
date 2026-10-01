"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "in" ? signIn : signUp, {});

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password" hint={mode === "up" ? "at least 10 characters" : undefined}>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          minLength={10}
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      )}
      {state.notice && <p className="text-[13px] text-ok">{state.notice}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "One moment…" : mode === "in" ? "Enter" : "Create my space"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="block w-full text-center text-[13px] text-ink-faint hover:text-ink-soft"
      >
        {mode === "in" ? "First time here? Create your space" : "Already have a space? Enter"}
      </button>
    </form>
  );
}
