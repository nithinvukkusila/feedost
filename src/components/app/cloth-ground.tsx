// The ground for the screens that come before the book (sign-in, the way back from Google, the two
// setup steps): a phone shows the page colour as it always did; from 768 up the cloth with its dashed
// stitch fills the window and the screen sits on it as one slip, centred (docs/DESIGN.md "Wide screens").
// CSS only. The slip's width is `md:max-w-md` (28rem) or, for the setup form, `md:max-w-xl` (36rem).
import type { ReactNode } from "react";

const widths = { narrow: "md:max-w-md", form: "md:max-w-xl" } as const;

export function ClothGround({ width = "narrow", children }: Readonly<{ width?: keyof typeof widths; children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-page md:flex md:items-center md:justify-center md:on-cloth-ground md:bg-cloth md:p-6 md:outline-2 md:-outline-offset-8 md:outline-stitch md:outline-dashed">
      <div className={`relative w-full bg-page md:border-2 md:border-ink md:shadow-slip md:ground-shadow ${widths[width]}`}>
        {/* Paper again inside the slip: the focus ring is blue here, not the cloth's yellow. */}
        <div className="on-paper-ground">{children}</div>
      </div>
    </div>
  );
}
