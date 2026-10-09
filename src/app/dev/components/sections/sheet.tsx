import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SheetFrame } from "@/components/ui/sheet";
import { SheetDemo } from "../demos";
import { copy, langs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function SheetSection() {
  const en = sample.en;
  return (
    <Section id="sheet" title={copy.sheet.title}>
      <Example caption={copy.sheet.still} testId="sheet-still">
        {/* The sheet's own markup, not modal, in a box the height of a small phone. */}
        <div className="h-136 border-2 border-ink">
          <SheetFrame
            title={en.sheet.title}
            titleId="sheet-still-title"
            closeLabel={en.sheet.close}
            context={{ label: en.sheet.contextLabel, title: en.sheet.contextTitle }}
          >
            <div className="flex flex-col gap-5">
              <Field label={copy.sheet.amountLabel} defaultValue={copy.sheet.amountValue} inputMode="numeric" autoComplete="off" />
              <p className="type-caption text-ink-soft">{en.sheet.body}</p>
              <div className="pr-1.5">
                <Button variant="record" full>
                  {en.button.markPaid}
                </Button>
              </div>
            </div>
          </SheetFrame>
        </div>
      </Example>

      {langs.map((lang) => {
        const s = sample[lang];
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={copy.sheet.open}>
              <SheetDemo
                id={lang}
                openLabel={s.sheet.open}
                title={s.sheet.title}
                closeLabel={s.sheet.close}
                context={{ label: s.sheet.contextLabel, title: s.sheet.contextTitle }}
                body={s.sheet.body}
                fieldLabel={s.field.label}
                fieldValue={s.field.value}
                actionLabel={s.button.markPaid}
              />
            </Example>
            {lang === "en" ? (
              <Example caption={copy.sheet.tall}>
                <SheetDemo
                  id="tall"
                  openLabel={s.sheet.open}
                  title={s.sheet.title}
                  closeLabel={s.sheet.close}
                  body={s.sheet.body}
                  fieldLabel={s.field.label}
                  fieldValue={s.field.value}
                  actionLabel={s.button.markPaid}
                  lines={30}
                  line={copy.sheet.line}
                />
              </Example>
            ) : null}
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
