// The frame of a signed-in screen: a phone-width column on the page colour, the screen's own content
// above and, on the five main screens, the bottom navigation pinned to the foot of the window.
import type { ReactNode } from "react";
import type { BottomNavKey } from "@/components/ui/bottom-nav";
import { AppNav } from "./app-nav";

export function AppScreen({ nav, children }: Readonly<{ nav?: BottomNavKey; children: ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-page">
      <main className="flex flex-1 flex-col">{children}</main>
      {nav ? (
        <div data-sticky-nav="" className="sticky bottom-0 z-10">
          <AppNav current={nav} />
        </div>
      ) : null}
    </div>
  );
}
