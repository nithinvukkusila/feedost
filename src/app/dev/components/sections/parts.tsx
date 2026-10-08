// Layout helpers for the dev page only. Not design-system components.
import type { ReactNode } from "react";
import { langNames, type Lang } from "../sample-data";

/** One section of the page. `id` becomes the test id `section-<id>`. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={`section-${id}`}
      aria-labelledby={`section-${id}-title`}
      className="flex flex-col gap-6 border-t-2 border-ink pt-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id={`section-${id}-title`} className="type-headline text-4xl">
          {title}
        </h2>
        {note ? <p className="type-body-sm text-ink-soft">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A captioned example. The caption is always English, whatever script the example is in. */
export function Example({
  caption,
  children,
  testId,
}: {
  caption: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-col gap-2">
      <p lang="en" className="type-label text-ink-label">
        {caption}
      </p>
      {children}
    </div>
  );
}

/** A block of examples in one script, marked with its `lang` so the type rules apply. */
export function ScriptBlock({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <div lang={lang} data-testid={`lang-${lang}`} className="flex flex-col gap-4">
      <p lang="en" className="type-label border-b border-rule pb-1 text-cloth">
        {langNames[lang]}
      </p>
      {children}
    </div>
  );
}
