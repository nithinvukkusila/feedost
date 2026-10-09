import { Field } from "@/components/ui/field";
import { copy, indicLangs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

// What a UPI ID field would set on a real screen.
const upi = { inputMode: "email", autoCapitalize: "none", autoComplete: "off", spellCheck: false } as const;

export function FieldSection() {
  const en = sample.en.field;
  return (
    <Section id="field" title={copy.field.title}>
      {/* The four states sit in one column with nothing between, so equal heights are easy to see and test. */}
      <div data-testid="field-states" className="flex flex-col gap-4">
        <Example caption={copy.field.empty} testId="field-empty">
          <Field label={en.label} placeholder={en.placeholder} {...upi} />
        </Example>
        <Example caption={copy.field.typing} testId="field-typing">
          <Field label={en.label} defaultValue={en.partial} data-force="focus" {...upi} />
        </Example>
        <Example caption={copy.field.correct} testId="field-correct">
          <Field
            label={en.label}
            defaultValue={en.value}
            state="correct"
            stateLabel={en.correctLabel}
            message={en.correctMessage}
            {...upi}
          />
        </Example>
        <Example caption={copy.field.error} testId="field-error">
          <Field
            label={en.label}
            defaultValue={en.wrong}
            state="error"
            stateLabel={en.errorLabel}
            message={en.errorShort}
            {...upi}
          />
        </Example>
      </div>
      <Example caption={copy.field.helper} testId="field-helper">
        <Field label={en.label} placeholder={en.placeholder} helper={en.helper} {...upi} />
      </Example>
      <Example caption={copy.field.long} testId="field-long">
        <Field
          label={en.longLabel}
          defaultValue={en.wrong}
          state="error"
          stateLabel={en.errorLabel}
          message={en.errorMessage}
          {...upi}
        />
      </Example>

      {indicLangs.map((lang) => {
        const f = sample[lang].field;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Field label={f.label} placeholder={f.placeholder} helper={f.helper} {...upi} />
            <Field
              label={f.label}
              defaultValue={f.value}
              state="correct"
              stateLabel={f.correctLabel}
              message={f.correctMessage}
              {...upi}
            />
            <Field
              label={f.longLabel}
              defaultValue={f.wrong}
              state="error"
              stateLabel={f.errorLabel}
              message={f.errorMessage}
              {...upi}
            />
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
