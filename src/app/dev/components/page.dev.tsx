// /dev/components: every token, type role and component in one place.
// The `.dev.tsx` extension is a page extension only outside production (next.config.ts), so a
// production build has no such route and ships none of this folder.
import type { Metadata } from "next";
import { copy } from "./sample-data";
import { BannerSection } from "./sections/banner";
import { BottomNavSection } from "./sections/bottom-nav";
import { ButtonSection } from "./sections/button";
import { FieldSection } from "./sections/field";
import { FormatsSection } from "./sections/formats";
import { RowSection } from "./sections/row";
import { RupeeSection } from "./sections/rupee";
import { SegmentedSection } from "./sections/segmented";
import { SelectFieldSection } from "./sections/select-field";
import { SheetSection } from "./sections/sheet";
import { SlipSection } from "./sections/slip";
import { StampSection } from "./sections/stamp";
import { StatusTagSection } from "./sections/status-tag";
import { StudentStripSection } from "./sections/student-strip";
import { SwitchSection } from "./sections/switch";
import { TabsSection } from "./sections/tabs";
import { TokensSection } from "./sections/tokens";
import { TypeSection } from "./sections/type";

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: false },
};

export default function DevComponentsPage() {
  return (
    // Side padding of 20px keeps a pressed button's 5px move from adding sideways scroll.
    <main id="top" className="mx-auto flex max-w-md flex-col gap-10 px-5 pt-6 pb-16">
      <header className="flex flex-col gap-3">
        <h1 className="type-headline text-5xl">{copy.title}</h1>
        <p className="type-body text-ink-soft">{copy.intro}</p>
      </header>
      <TokensSection />
      <TypeSection />
      <RupeeSection />
      <ButtonSection />
      <FieldSection />
      <SlipSection />
      <RowSection />
      <StatusTagSection />
      <StampSection />
      <TabsSection />
      <SheetSection />
      <SegmentedSection />
      <SwitchSection />
      <StudentStripSection />
      <BottomNavSection />
      <BannerSection />
      {/* After the thirteen F2 components: SelectField arrived with slice R0-2. */}
      <SelectFieldSection />
      <FormatsSection />
    </main>
  );
}
