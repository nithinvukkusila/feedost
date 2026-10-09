// /dev/supabase: which Supabase project does this build talk to? The `.dev.tsx` extension is a page
// extension only outside a Vercel production build (next.config.ts), so production has no such route
// and ships none of this folder.
import type { Metadata } from "next";
import { copy } from "./copy";
import { EnvCheck } from "./env-check";

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: false },
};

export default function DevSupabasePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-6 pb-16">
      <header className="flex flex-col gap-3">
        <h1 className="type-headline text-5xl">{copy.title}</h1>
        <p className="type-body text-ink-soft">{copy.intro}</p>
      </header>
      <EnvCheck />
    </main>
  );
}
