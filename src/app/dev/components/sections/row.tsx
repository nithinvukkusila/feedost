import { RoundButton } from "@/components/ui/button";
import { Row, Rows } from "@/components/ui/row";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import { StatusTag } from "@/components/ui/status-tag";
import { SendIcon } from "../sample-icons";
import { copy, figures, langs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function RowSection() {
  return (
    <Section id="row" title={copy.row.title}>
      {langs.map((lang) => {
        const s = sample[lang];
        const r = s.row;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={copy.row.tones}>
              <Slip className="px-3">
                <Rows>
                  <Row
                    name={r.name}
                    meta={r.metaOverdue}
                    tone="overdue"
                    amount={figures.row}
                    trailing={<RoundButton label={s.button.roundLabel} icon={<SendIcon />} />}
                  />
                  <Row
                    name={r.name2}
                    meta={r.metaDue}
                    tone="due"
                    // As on the canvas: a row with a status tag has no amount column.
                    tag={<StatusTag status="due">{s.tag.due}</StatusTag>}
                  />
                  <Row
                    name={r.name3}
                    meta={r.metaPaid}
                    tone="paid"
                    amount={figures.row}
                    // The meta line already says "paid", so the stamp is decoration here.
                    trailing={
                      <Stamp size="sm" tone="stamp" decorative>
                        {s.stamp.paid}
                      </Stamp>
                    }
                  />
                </Rows>
              </Slip>
            </Example>
            <Example caption={copy.row.link}>
              <Slip className="px-3">
                <Rows>
                  <Row
                    name={r.name}
                    meta={r.metaOverdue}
                    tone="overdue"
                    amount={figures.rowLarge}
                    href="#top"
                    trailing={<RoundButton label={s.button.roundLabel} icon={<SendIcon />} />}
                  />
                </Rows>
              </Slip>
            </Example>
            <Example caption={copy.row.long}>
              <Slip className="px-3">
                <Rows>
                  <Row
                    name={r.longName}
                    meta={r.longMeta}
                    tone="overdue"
                    amount={figures.rowLarge}
                    href="#top"
                    trailing={<RoundButton label={s.button.roundLabel} icon={<SendIcon />} />}
                  />
                </Rows>
              </Slip>
            </Example>
            {lang === "en" ? (
              <Example caption={copy.row.plain}>
                <Slip className="px-3">
                  <Rows>
                    <Row name={r.name} meta={r.metaDue} tone="due" />
                  </Rows>
                </Slip>
              </Example>
            ) : null}
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
