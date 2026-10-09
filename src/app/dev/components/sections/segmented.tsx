import { Segmented } from "@/components/ui/segmented";
import { Slip } from "@/components/ui/slip";
import { SegmentedDemo } from "../demos";
import { copy, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

function languageOptions(lang: Lang) {
  const g = sample[lang].segmented;
  return [
    { value: "en", label: g.english },
    { value: "hi", label: g.hindi },
    { value: "kn", label: g.kannada },
    { value: "te", label: g.telugu },
  ] as const;
}

export function SegmentedSection() {
  const en = sample.en.segmented;
  const c = copy.segmented;
  return (
    <Section id="segmented" title={c.title} note={c.note}>
      {langs.map((lang) => {
        const g = sample[lang].segmented;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={c.two} testId={`segmented-two-${lang}`}>
              <Segmented
                label={g.paidBy}
                name={`seg-two-${lang}`}
                defaultValue="upi"
                options={[
                  { value: "upi", label: g.upi },
                  { value: "cash", label: g.cash },
                ]}
              />
            </Example>
            <Example caption={c.twoLine} testId={`segmented-two-line-${lang}`}>
              <Segmented
                label={g.tone}
                name={`seg-two-line-${lang}`}
                defaultValue="polite"
                options={[
                  { value: "polite", label: g.polite, detail: g.politeDetail },
                  { value: "firm", label: g.firm, detail: g.firmDetail },
                ]}
              />
            </Example>
            <Example caption={c.three} testId={`segmented-three-${lang}`}>
              <Segmented
                label={g.when}
                name={`seg-three-${lang}`}
                defaultValue="today"
                options={[
                  { value: "today", label: g.today },
                  { value: "yesterday", label: g.yesterday },
                  { value: "pick", label: g.pickDate },
                ]}
              />
            </Example>
            <Example caption={c.four} testId={`segmented-four-${lang}`}>
              <Segmented label={g.language} name={`seg-four-${lang}`} defaultValue={lang} options={languageOptions(lang)} />
            </Example>
            <Example caption={c.long} testId={`segmented-long-${lang}`}>
              <Segmented
                label={g.longLabel}
                name={`seg-long-${lang}`}
                defaultValue="a"
                options={[
                  { value: "a", label: g.longA },
                  { value: "b", label: g.longB },
                  { value: "c", label: g.pickDate },
                ]}
              />
            </Example>
          </ScriptBlock>
        );
      })}

      <Example caption={c.focusChosen} testId="segmented-focus-chosen">
        <Slip className="p-4">
          <Segmented
            label={en.when}
            name="seg-focus-chosen"
            defaultValue="today"
            options={[
              { value: "today", label: en.today, attrs: { "data-force": "focus" } },
              { value: "yesterday", label: en.yesterday },
              { value: "pick", label: en.pickDate },
            ]}
          />
        </Slip>
      </Example>
      <Example caption={c.focusOther} testId="segmented-focus-other">
        <Slip className="p-4">
          <Segmented
            label={en.when}
            name="seg-focus-other"
            defaultValue="today"
            options={[
              { value: "today", label: en.today },
              { value: "yesterday", label: en.yesterday },
              { value: "pick", label: en.pickDate, attrs: { "data-force": "focus" } },
            ]}
          />
        </Slip>
      </Example>
      <Example caption={c.live} testId="segmented-live">
        <SegmentedDemo label={en.language} name="seg-live" options={languageOptions("en")} chosenLabel={c.chosen} />
      </Example>
    </Section>
  );
}
