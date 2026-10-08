import { Stamp } from "@/components/ui/stamp";
import { StampReplay } from "../demos";
import { copy, figures, indicLangs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function StampSection() {
  const en = sample.en.stamp;
  return (
    <Section id="stamp" title={copy.stamp.title}>
      <Example caption={copy.stamp.sm} testId="stamp-sm">
        <div className="flex items-center gap-5 py-2">
          <Stamp size="sm" tone="stamp" label={en.paidLabel}>
            {en.paid}
          </Stamp>
          <Stamp size="sm" tone="blue" label={en.sentLabel}>
            {en.sent}
          </Stamp>
        </div>
      </Example>
      <Example caption={copy.stamp.md} testId="stamp-md">
        <div className="flex flex-wrap items-center gap-5 py-3">
          <Stamp size="md" tone="stamp" label={en.paidLabel} secondLine={figures.date}>
            {en.paid}
          </Stamp>
          <Stamp size="md" tone="blue" label={en.sentLabel} secondLine={en.count}>
            {en.sent}
          </Stamp>
        </div>
      </Example>
      <Example caption={copy.stamp.lg} testId="stamp-lg">
        <div className="flex flex-col items-start gap-6 py-3">
          <Stamp size="lg" tone="stamp" label={en.allPaidLabel} secondLine={en.month}>
            {en.allPaid}
          </Stamp>
          <Stamp size="lg" tone="blue" label={en.sentLabel} secondLine={en.count}>
            {en.sent}
          </Stamp>
        </div>
      </Example>
      <Example caption={copy.stamp.animated} testId="stamp-animated">
        <StampReplay word={en.paid} label={en.paidLabel} secondLine={figures.date} replayLabel={copy.stamp.replay} />
      </Example>

      {indicLangs.map((lang) => {
        const s = sample[lang].stamp;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <div className="flex flex-wrap items-center gap-5 py-3">
              <Stamp size="sm" tone="stamp" label={s.paidLabel}>
                {s.paid}
              </Stamp>
              <Stamp size="md" tone="stamp" label={s.paidLabel} secondLine={figures.date}>
                {s.paid}
              </Stamp>
              <Stamp size="md" tone="blue" label={s.sentLabel} secondLine={s.count}>
                {s.sent}
              </Stamp>
            </div>
            <div className="py-3">
              <Stamp size="lg" tone="stamp" label={s.allPaidLabel} secondLine={s.month}>
                {s.allPaid}
              </Stamp>
            </div>
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
