// The frame of a signed-in screen, and the one place that decides how wide a page is (docs/DESIGN.md
// "Wide screens"). All of it is CSS on one DOM: no script reads the window width.
//   below 768   a phone column, at most 448px, as it always was
//   768 to 1023 the same column, 42rem wide, with the bottom navigation
//   1024 and up the "book": the cloth as the ground, the book on it (at most 80rem), the navigation
//               down its left side, the screen's content in a column beside it.
// The navigation comes first in the page so the keyboard reaches it first on a laptop; below 1024 it is
// drawn last, pinned to the foot of the window. `above` (the Undo banner) sits on top of it there and
// at the foot of the content from 1024.
import type { ReactNode } from "react";
import type { BottomNavKey } from "@/components/ui/bottom-nav";
import { brand } from "@/config/brand";
import { AppNav } from "./app-nav";

// The cloth ground behind the book, with its dashed stitch, from 1024 up.
const ground = "min-h-dvh lg:flex lg:p-6 lg:on-cloth-ground lg:bg-cloth lg:outline-2 lg:-outline-offset-8 lg:outline-stitch lg:outline-dashed";
// The book: the page colour, a column on a phone, a navigation beside the content on a laptop.
const book =
  "mx-auto flex min-h-dvh w-full max-w-md flex-col bg-page md:max-w-2xl lg:min-h-0 lg:max-w-7xl lg:flex-1 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:border-2 lg:border-ink lg:shadow-slip lg:ground-shadow";
// The content: in the second column of the book, a readable column of its own.
export const contentColumn = "lg:col-start-2 lg:row-start-1 lg:mx-auto lg:w-full lg:max-w-2xl";
const content = `on-paper-ground flex flex-1 flex-col ${contentColumn}`;
// The navigation column: the foot of a phone's window, or the left side of the book, which stays in view.
const side = "lg:w-sidenav lg:sticky lg:top-0 lg:col-start-1 lg:row-start-1 lg:flex lg:h-dvh lg:flex-col lg:self-start lg:overflow-y-auto lg:border-r-2 lg:border-ink lg:bg-slip";

/** The cloth and the book, around whatever is passed. Only the screens' frame uses this. */
export function Book({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={ground}>
      <div data-book="" className={book}>
        {children}
      </div>
    </div>
  );
}

/** `above` sits on top of the navigation, in the same pinned block (the undo banner after a payment). */
export function AppScreen({ nav, above, children }: Readonly<{ nav?: BottomNavKey; above?: ReactNode; children: ReactNode }>) {
  return (
    <Book>
      {nav ? (
        // First in the page, drawn last on a phone (order-last). From 1024 the wrapper itself has no box: its children are the book's grid items.
        <div data-sticky-nav="" className="sticky bottom-0 z-10 order-last flex flex-col lg:contents">
          <div className={`order-last ${side}`}>
            {/* The name is drawn from an attribute, so it is not a second copy of the name in the page's text. */}
            <p aria-hidden="true" data-side-brand={brand.name} className="type-headline hidden px-4 pt-5 pb-3 text-2xl text-cloth before:content-[attr(data-side-brand)] lg:block" />
            <AppNav current={nav} />
          </div>
          {above ? <div className={`on-paper-ground lg:sticky lg:bottom-0 lg:z-10 lg:self-end ${contentColumn}`}>{above}</div> : null}
        </div>
      ) : null}
      <main className={`${content}${above ? " lg:pb-32" : ""}`}>{children}</main>
    </Book>
  );
}
