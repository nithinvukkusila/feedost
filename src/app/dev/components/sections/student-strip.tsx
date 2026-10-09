import { Slip } from "@/components/ui/slip";
import { StudentStrip, type StripBlock } from "@/components/ui/student-strip";
import { copy, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

type Counts = { paid: number; due: number; overdue: number };

function blocksFor({ paid, due, overdue }: Counts): StripBlock[] {
  return [...Array<StripBlock>(paid).fill("paid"), ...Array<StripBlock>(due).fill("due"), ...Array<StripBlock>(overdue).fill("overdue")];
}

const fill = (text: string, n: number) => text.replace("{n}", String(n));

function Strip({ lang, counts, long = false }: { lang: Lang; counts: Counts; long?: boolean }) {
  const s = sample[lang].strip;
  const total = counts.paid + counts.due + counts.overdue;
  return (
    <StudentStrip
      blocks={blocksFor(counts)}
      label={s.label
        .replace("{t}", String(total))
        .replace("{p}", String(counts.paid))
        .replace("{d}", String(counts.due))
        .replace("{o}", String(counts.overdue))}
      legend={{
        paid: fill(long ? s.longPaid : s.paid, counts.paid),
        due: fill(long ? s.longDue : s.due, counts.due),
        overdue: fill(long ? s.longOverdue : s.overdue, counts.overdue),
      }}
    />
  );
}

const typical: Counts = { paid: 14, due: 4, overdue: 5 };

export function StudentStripSection() {
  const c = copy.strip;
  return (
    <Section id="student-strip" title={c.title} note={c.note}>
      {langs.map((lang) => (
        <ScriptBlock key={lang} lang={lang}>
          <Example caption={c.typical} testId={`strip-23-${lang}`}>
            <Strip lang={lang} counts={typical} />
          </Example>
          <Example caption={c.long} testId={`strip-long-${lang}`}>
            <Strip lang={lang} counts={typical} long />
          </Example>
          {lang === "en" ? (
            <>
              <Example caption={c.one} testId="strip-1">
                <Strip lang={lang} counts={{ paid: 0, due: 1, overdue: 0 }} />
              </Example>
              <Example caption={c.many} testId="strip-60">
                <Strip lang={lang} counts={{ paid: 36, due: 14, overdue: 10 }} />
              </Example>
              <Example caption={c.onSlip} testId="strip-on-slip">
                <Slip className="p-4">
                  <Strip lang={lang} counts={typical} />
                </Slip>
              </Example>
              <Example caption={c.none}>
                <div data-testid="strip-0" className="min-h-6 border-2 border-dashed border-ink-label">
                  <Strip lang={lang} counts={{ paid: 0, due: 0, overdue: 0 }} />
                </div>
              </Example>
            </>
          ) : null}
        </ScriptBlock>
      ))}
    </Section>
  );
}
