import templates from "@/lib/reminder/templates.json";
import { SelectFieldDemo } from "../demos";
import { copy, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

// The month names are the fee reminder's own (one list, not two).
const months = (lang: Lang) => templates[lang].months.map((label, index) => ({ value: String(index), label }));

export function SelectFieldSection() {
  const en = sample.en.select;
  const c = copy.selectField;
  return (
    <Section id="select-field" title={c.title} note={c.note}>
      {langs.map((lang) => {
        const w = sample[lang].select;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={c.rest} testId={`select-rest-${lang}`}>
              <SelectFieldDemo id={`rest-${lang}`} label={w.month} options={months(lang)} start="9" />
            </Example>
            <Example caption={c.long} testId={`select-long-${lang}`}>
              <SelectFieldDemo id={`long-${lang}`} label={w.month} options={months(lang)} start="8" helper={w.helper} />
            </Example>
          </ScriptBlock>
        );
      })}
      <Example caption={c.focus} testId="select-focus">
        <SelectFieldDemo id="focus" label={en.month} options={months("en")} start="9" force="focus" />
      </Example>
      <Example caption={c.disabled} testId="select-disabled">
        <SelectFieldDemo id="disabled" label={en.month} options={months("en")} start="9" disabled />
      </Example>
    </Section>
  );
}
