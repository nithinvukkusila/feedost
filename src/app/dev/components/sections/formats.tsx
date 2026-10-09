import { formatDate, formatPhone, formatRupees } from "@/lib/format";
import { copy, formatInputs, langs } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

/** The same six formatter calls in a block for each language. The text must be identical in all four. */
export function FormatsSection() {
  return (
    <Section id="formats" title={copy.formats.title} note={copy.formats.note}>
      {langs.map((lang) => (
        <ScriptBlock key={lang} lang={lang}>
          <Example caption={copy.formats.rupees}>
            <ul translate="no" className="flex flex-col gap-1">
              {formatInputs.paise.map((paise) => (
                <li key={paise} data-format="rupees" className="type-body">
                  {formatRupees(paise)}
                </li>
              ))}
            </ul>
          </Example>
          <Example caption={copy.formats.date}>
            <p translate="no" data-format="date" className="type-body">
              {formatDate(formatInputs.date)}
            </p>
          </Example>
          <Example caption={copy.formats.phone}>
            <p translate="no" data-format="phone" className="type-body">
              {formatPhone(formatInputs.phone)}
            </p>
          </Example>
        </ScriptBlock>
      ))}
    </Section>
  );
}
