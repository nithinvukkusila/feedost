import { SwitchDemo } from "../demos";
import { copy, langs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function SwitchSection() {
  const en = sample.en.switch;
  const c = copy.switch;
  return (
    <Section id="switch" title={c.title} note={c.note}>
      {langs.map((lang) => {
        const w = sample[lang].switch;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <div className="flex flex-wrap gap-6">
              <Example caption={c.on}>
                <SwitchDemo id={`${lang}-on`} start label={w.name} onText={w.on} offText={w.off} />
              </Example>
              <Example caption={c.off}>
                <SwitchDemo id={`${lang}-off`} label={w.name} onText={w.on} offText={w.off} />
              </Example>
            </div>
            <Example caption={c.long}>
              <div className="flex flex-wrap gap-6">
                <SwitchDemo id={`${lang}-long-on`} start label={w.name} onText={w.longOn} offText={w.longOff} />
                <SwitchDemo id={`${lang}-long-off`} label={w.name} onText={w.longOn} offText={w.longOff} />
              </div>
            </Example>
            <Example caption={c.labelled}>
              <SwitchDemo id={`${lang}-labelled`} start visibleLabel={w.visibleLabel} onText={w.on} offText={w.off} />
            </Example>
          </ScriptBlock>
        );
      })}
      <Example caption={c.focus} testId="switch-focus">
        <div className="flex flex-wrap gap-6 py-1">
          <SwitchDemo id="focus-on" start force="focus" label={en.name} onText={en.on} offText={en.off} />
          <SwitchDemo id="focus-off" force="focus" label={en.name} onText={en.on} offText={en.off} />
        </div>
      </Example>
    </Section>
  );
}
