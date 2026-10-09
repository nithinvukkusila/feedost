import { Slip } from "@/components/ui/slip";
import { StatusTag } from "@/components/ui/status-tag";
import { copy, langs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function StatusTagSection() {
  return (
    <Section id="status-tag" title={copy.tag.title}>
      {langs.map((lang) => {
        const t = sample[lang].tag;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={copy.tag.four}>
              <Slip className="flex flex-wrap items-start gap-3 p-4">
                <StatusTag status="overdue">{t.overdue}</StatusTag>
                <StatusTag status="due">{t.due}</StatusTag>
                <StatusTag status="part-paid">{t.partPaid}</StatusTag>
                <StatusTag status="paid">{t.paid}</StatusTag>
              </Slip>
            </Example>
            <Example caption={copy.tag.long}>
              <div className="flex w-40 flex-col items-start gap-3">
                <StatusTag status="overdue">{t.long}</StatusTag>
                <StatusTag status="paid">{t.long}</StatusTag>
              </div>
            </Example>
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
