import { BottomNav, type BottomNavItem, type BottomNavKey } from "@/components/ui/bottom-nav";
import { NavAttendanceIcon, NavHomeIcon, NavMoreIcon, NavStudentsIcon } from "../sample-icons";
import { copy, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

function itemsFor(lang: Lang, long = false): Record<BottomNavKey, BottomNavItem> {
  const n = sample[lang].nav;
  return {
    home: { href: "#top", label: n.home, icon: <NavHomeIcon /> },
    students: { href: "#top", label: long ? n.longStudents : n.students, icon: <NavStudentsIcon /> },
    attendance: { href: "#top", label: long ? n.longAttendance : n.attendance, icon: <NavAttendanceIcon /> },
    more: { href: "#top", label: n.more, icon: <NavMoreIcon /> },
  };
}

// A different current item in each language, so all four positions of the bar are on the page.
const currentIn: Record<Lang, BottomNavKey> = { en: "home", hi: "students", kn: "attendance", te: "more" };

export function BottomNavSection() {
  const c = copy.nav;
  const forced = itemsFor("en");
  forced.students = { ...forced.students, attrs: { "data-force": "focus" } };
  forced.home = { ...forced.home, attrs: { "data-force": "focus" } };
  return (
    <Section id="bottom-nav" title={c.title} note={c.note}>
      {langs.map((lang) => (
        <ScriptBlock key={lang} lang={lang}>
          <Example caption={c.standard} testId={`nav-${lang}`}>
            {/* Pulled out to the screen edges, as the real bar is: four columns of 90px at 360px. */}
            <div className="-mx-5">
              <BottomNav label={sample[lang].nav.label} items={itemsFor(lang)} current={currentIn[lang]} />
            </div>
          </Example>
          <Example caption={c.long} testId={`nav-long-${lang}`}>
            <div className="-mx-5">
              <BottomNav label={`${sample[lang].nav.label} ${c.longSuffix}`} items={itemsFor(lang, true)} current={currentIn[lang]} />
            </div>
          </Example>
        </ScriptBlock>
      ))}
      <Example caption={c.focus} testId="nav-focus">
        <div className="-mx-5">
          <BottomNav label={`${sample.en.nav.label} ${c.focus}`} items={forced} current="home" />
        </div>
      </Example>
    </Section>
  );
}
