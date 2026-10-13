// The frame of the parent's pay page (spec R1-9 criteria 22 and 35): one centred column at most 28rem on every window
// width, with the cloth header and footer. It never uses AppScreen or the tutor navigation. Two grounds: the paper
// one (fee page, states) with a cloth header that the slip overlaps, and the cloth one (the consent screen), where
// the whole column is cloth and the notice sits at its foot as a slip.
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { cx } from "@/lib/cx";

const stitched = "on-cloth-ground bg-cloth text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed";

type FrameProps = {
  lang: Locale;
  /** For tests and e2e: which screen is showing. */
  state: string;
  busy?: boolean;
  ground: "paper" | "cloth";
  header?: ReactNode;
  footer?: { title: string; body: string } | null;
  children: ReactNode;
};

export function Frame({ lang, state, busy = false, ground, header, footer, children }: Readonly<FrameProps>) {
  return (
    <main
      lang={lang}
      data-state={state}
      aria-busy={busy}
      className={cx("mx-auto flex min-h-dvh w-full max-w-md flex-col", ground === "cloth" ? `${stitched} justify-end` : "")}
    >
      {header}
      {children}
      {ground === "paper" ? <div className="grow" /> : null}
      {footer ? (
        <footer className={cx(stitched, "px-5 pt-4 pb-5")}>
          <p className="type-headline text-2xl">{brand.name}</p>
          <p className="type-headline text-xl">{footer.title}</p>
          <p className="type-body text-on-cloth-soft">{footer.body}</p>
        </footer>
      ) : null}
    </main>
  );
}

type HeaderProps = {
  label: string;
  /** The tutor's name as saved, or the plain words for "your tutor". `null` draws the loading block. */
  name: string | null;
  nameIsSaved: boolean;
  /** Lines under the name (what the tutor teaches; "for {student}" on the consent screen). */
  lines: ReactNode[];
  /** The language button, when there is one. */
  action?: ReactNode;
  /** Paper ground: bottom room so the slip can overlap the cloth. */
  overlap: boolean;
};

export function PayHeader({ label, name, nameIsSaved, lines, action, overlap }: Readonly<HeaderProps>) {
  return (
    <header className={cx("flex items-start justify-between gap-2.5", overlap ? `${stitched} px-5 pt-5 pb-17.5` : "px-6 pt-7 pb-5")}>
      <div className="min-w-0">
        <p className="type-label">{label}</p>
        {name === null ? (
          // Loading: a plain block where the tutor's name will be (never a bare spinner, never data that has not arrived).
          <div aria-hidden="true" className="mt-2 h-9 w-48 max-w-full bg-tab-idle" />
        ) : (
          <p translate={nameIsSaved ? "no" : undefined} className="type-headline mt-0.5 text-4xl wrap-anywhere">
            {name}
          </p>
        )}
        {lines.map((line, index) => (
          <p key={index} className="type-body-sm text-on-cloth-soft wrap-anywhere">
            {line}
          </p>
        ))}
      </div>
      {action}
    </header>
  );
}
