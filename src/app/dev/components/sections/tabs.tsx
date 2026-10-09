import { TabsDemo, type TabsDemoRow } from "../demos";
import { copy, figures, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

function rowsFor(lang: Lang): Record<string, TabsDemoRow> {
  const r = sample[lang].row;
  return {
    overdue: { name: r.name, meta: r.metaOverdue, tone: "overdue", amount: figures.row },
    due: { name: r.name2, meta: r.metaDue, tone: "due", amount: figures.row },
    paid: { name: r.name3, meta: r.metaPaid, tone: "paid", amount: figures.row },
  };
}

export function TabsSection() {
  return (
    <Section id="tabs" title={copy.tabs.title} note={copy.tabs.panel}>
      {langs.map((lang) => {
        const t = sample[lang].tabs;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={copy.tabs.standard}>
              <TabsDemo
                label={t.listLabel}
                panelId={`tabs-${lang}`}
                rows={rowsFor(lang)}
                tabs={[
                  { id: "overdue", label: t.overdue, count: 5 },
                  { id: "due", label: t.due, count: 4 },
                  { id: "paid", label: t.paid, count: 14 },
                ]}
              />
            </Example>
            <Example caption={copy.tabs.long}>
              <TabsDemo
                label={t.listLabel}
                panelId={`tabs-long-${lang}`}
                rows={rowsFor(lang)}
                tabs={[
                  { id: "overdue", label: t.longOverdue, count: 5 },
                  { id: "due", label: t.longDue, count: 4 },
                  { id: "paid", label: t.longPaid, count: 14 },
                ]}
              />
            </Example>
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
