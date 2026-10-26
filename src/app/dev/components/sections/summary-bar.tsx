import type { ReactNode } from "react";
import { Slip } from "@/components/ui/slip";
import { SummaryBar, SummaryPending } from "@/components/ui/summary-bar";
import { formatRupees } from "@/lib/format";
import { copy, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

type Amounts = { collected: number | null; due: number; overdue: number };

// The amount goes in a DM Mono span with 0 to 9 digits, as on the home screen.
function fill(text: string, amount: ReactNode): ReactNode {
  const [before, after] = text.split("{a}");
  return (
    <>
      {before}
      {amount}
      {after}
    </>
  );
}

const money = (paise: number) => (
  <span translate="no" className="type-amount-row">
    {formatRupees(paise)}
  </span>
);

function Bar({ lang, amounts, long = false, pending = false }: { lang: Lang; amounts: Amounts; long?: boolean; pending?: boolean }) {
  const s = sample[lang].summary;
  return (
    <SummaryBar
      collected={amounts.collected}
      due={amounts.due}
      overdue={amounts.overdue}
      labels={{
        collected: fill(long ? s.longCollected : s.collected, pending ? <SummaryPending label={s.pending} /> : money(amounts.collected ?? 0)),
        due: fill(long ? s.longDue : s.due, money(amounts.due)),
        overdue: fill(long ? s.longOverdue : s.overdue, money(amounts.overdue)),
      }}
    />
  );
}

const typical: Amounts = { collected: 1_200_000, due: 450_000, overdue: 300_000 };

export function SummaryBarSection() {
  const c = copy.summary;
  return (
    <Section id="summary-bar" title={c.title} note={c.note}>
      {langs.map((lang) => (
        <ScriptBlock key={lang} lang={lang}>
          <Example caption={c.typical} testId={`summary-typical-${lang}`}>
            <Bar lang={lang} amounts={typical} />
          </Example>
          <Example caption={c.long} testId={`summary-long-${lang}`}>
            <Bar lang={lang} amounts={typical} long />
          </Example>
          {lang === "en" ? (
            <>
              <Example caption={c.oneZero} testId="summary-one-zero">
                <Bar lang={lang} amounts={{ collected: 1_200_000, due: 450_000, overdue: 0 }} />
              </Example>
              <Example caption={c.allZero} testId="summary-all-zero">
                <Bar lang={lang} amounts={{ collected: 0, due: 0, overdue: 0 }} />
              </Example>
              <Example caption={c.pending} testId="summary-pending">
                <Bar lang={lang} amounts={{ collected: null, due: 450_000, overdue: 300_000 }} pending />
              </Example>
              <Example caption={c.tiny} testId="summary-tiny">
                <Bar lang={lang} amounts={{ collected: 50_000_000, due: 100, overdue: 100 }} />
              </Example>
              <Example caption={c.onSlip} testId="summary-on-slip">
                <Slip className="p-4">
                  <Bar lang={lang} amounts={typical} />
                </Slip>
              </Example>
            </>
          ) : null}
        </ScriptBlock>
      ))}
    </Section>
  );
}
