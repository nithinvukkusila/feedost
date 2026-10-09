import { amountFit } from "@/lib/amount-fit";
import { copy, figures, indicLangs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

/** A plain ledger line for judging the row amount before and beside the real Row component. */
function LedgerLine({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="flex min-h-row items-center gap-3 border-b border-rule">
      <div className="min-w-0 flex-1">
        <p className="type-name wrap-anywhere">{name}</p>
        <p className="type-caption font-semibold text-cloth wrap-anywhere">{meta}</p>
      </div>
      <p data-rupee="row" translate="no" className="type-amount-row shrink-0 whitespace-nowrap">
        {figures.rowLarge}
      </p>
    </div>
  );
}

export function RupeeSection() {
  return (
    <Section id="rupee" title={copy.rupee.title} note={copy.rupee.note}>
      <Example caption={copy.rupee.headline} testId="rupee-headline">
        <div className="amount-box">
          <p data-rupee="headline" translate="no" style={amountFit(figures.large)} className="type-amount amount-size-7xl text-blue">
            {figures.large}
          </p>
          <p data-rupee="headline" translate="no" style={amountFit(figures.largeRest)} className="type-amount amount-size-7xl text-blue">
            {figures.largeRest}
          </p>
        </div>
      </Example>

      <Example caption={copy.rupee.fit} testId="rupee-fit">
        <div className="amount-box">
          <p data-rupee="fit" translate="no" style={amountFit(figures.sixWide)} className="type-amount amount-size-7xl text-blue">
            {figures.sixWide}
          </p>
          <p data-rupee="fit" translate="no" style={amountFit(figures.sevenDigits)} className="type-amount amount-size-7xl text-blue">
            {figures.sevenDigits}
          </p>
        </div>
      </Example>
      <Example caption={copy.rupee.fitNarrow} testId="rupee-fit-narrow">
        <div className="amount-box w-1/2 border-b border-rule">
          <p data-rupee="fit" translate="no" style={amountFit(figures.large)} className="type-amount amount-size-7xl text-blue">
            {figures.large}
          </p>
          <p data-rupee="fit" translate="no" style={amountFit(figures.sevenDigits)} className="type-amount amount-size-7xl text-blue">
            {figures.sevenDigits}
          </p>
        </div>
      </Example>

      <Example caption={copy.rupee.reading} testId="rupee-reading">
        <p data-rupee="reading" translate="no" className="type-body font-bold">
          {figures.large}
        </p>
        <p data-rupee="reading" translate="no" className="type-body">
          {figures.allDigits}
        </p>
      </Example>

      <Example caption={copy.rupee.row} testId="rupee-row">
        <div className="border-2 border-ink bg-slip px-3">
          <LedgerLine name={sample.en.row.name} meta={sample.en.row.metaOverdue} />
          <div className="flex min-h-row items-center justify-between gap-3">
            <p data-rupee="row" translate="no" className="type-amount-row">
              {figures.row}
            </p>
            <p data-rupee="row" translate="no" className="type-amount-row">
              {figures.allDigits}
            </p>
          </div>
        </div>
      </Example>

      <Example caption={copy.rupee.rowEnlarged} testId="rupee-row-enlarged">
        {/* The row role's own stack and weight, at a size where a mismatch cannot hide. */}
        <p data-rupee="row-enlarged" translate="no" className="font-mono text-5xl font-medium">
          {figures.row}
        </p>
        <p data-rupee="row-enlarged" translate="no" className="font-mono text-3xl font-medium wrap-anywhere">
          {figures.allDigits}
        </p>
      </Example>

      <Example caption={copy.rupee.rowSignAlone} testId="rupee-row-alone">
        <p translate="no" className="flex items-baseline gap-6 font-mono text-5xl font-medium">
          <span data-rupee="sign-alone">{figures.rupee}</span>
          <span>{copy.rupee.digits.slice(0, 5)}</span>
        </p>
      </Example>

      <Example caption={copy.rupee.alternative} testId="rupee-alternative">
        <p translate="no" className="font-sans text-base font-medium tabular-nums">
          {figures.rowLarge}
        </p>
        <p translate="no" className="font-sans text-5xl font-medium tabular-nums">
          {figures.row}
        </p>
      </Example>

      {indicLangs.map((lang) => {
        const s = sample[lang];
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={copy.rupee.headline}>
              <p className="type-body font-bold text-cloth">{s.pending}</p>
              <div className="amount-box">
                <p data-rupee="headline" translate="no" style={amountFit(figures.fee)} className="type-amount amount-size-7xl text-blue">
                  {figures.fee}
                </p>
              </div>
              <p className="type-body text-ink-soft">{s.sentence}</p>
            </Example>
            <Example caption={copy.rupee.inScript}>
              <p className="type-body">
                {s.pending}{" "}
                <span data-rupee="reading" translate="no" className="type-amount text-lg">
                  {figures.large}
                </span>{" "}
                {s.sentence}
              </p>
            </Example>
            <Example caption={copy.rupee.inRow}>
              <div className="border-2 border-ink bg-slip px-3">
                <LedgerLine name={s.row.name} meta={s.row.metaOverdue} />
              </div>
            </Example>
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
