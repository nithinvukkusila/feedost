import { copy, figures, langs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function TypeSection() {
  return (
    <Section id="type" title={copy.type.title}>
      {langs.map((lang) => {
        const s = sample[lang];
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={copy.type.headline}>
              <p data-role="headline" className="type-headline text-4xl">
                {s.headline}
              </p>
            </Example>
            <Example caption={copy.type.amount}>
              <p data-role="amount" translate="no" className="type-amount text-6xl text-blue">
                {figures.fee}
              </p>
            </Example>
            <Example caption={copy.type.bodyLg}>
              <p data-role="body-lg" className="type-body-lg">
                {s.sentence}
              </p>
            </Example>
            <Example caption={copy.type.body}>
              <p data-role="body" className="type-body">
                {s.sentence}
              </p>
            </Example>
            <Example caption={copy.type.bodySm}>
              <p data-role="body-sm" className="type-body-sm text-ink-soft">
                {s.sentence}
              </p>
            </Example>
            <Example caption={copy.type.caption}>
              <p data-role="caption" className="type-caption text-ink-soft">
                {s.caption}
              </p>
            </Example>
            <Example caption={copy.type.label}>
              <p data-role="label" className="type-label text-ink-label">
                {s.label}
              </p>
            </Example>
            <Example caption={copy.type.control}>
              <p data-role="control" className="type-control">
                {s.button.remind}
              </p>
            </Example>
            <Example caption={copy.type.controlSm}>
              <p data-role="control-sm" className="type-control-sm">
                {s.tabs.longOverdue}
              </p>
            </Example>
            <Example caption={copy.type.name}>
              <p data-role="name" className="type-name">
                {s.row.name}
              </p>
            </Example>
            <Example caption={copy.type.amountRow}>
              <p data-role="amount-row" translate="no" className="type-amount-row">
                {figures.row}
              </p>
            </Example>
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
