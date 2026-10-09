import { Slip } from "@/components/ui/slip";
import { copy } from "../sample-data";
import { Example, Section } from "./parts";

export function SlipSection() {
  return (
    <Section id="slip" title={copy.slip.title}>
      <Example caption={copy.slip.standard} testId="slip-standard">
        <Slip className="p-4">
          <p className="type-body">{copy.slip.body}</p>
        </Slip>
      </Example>
      <Example caption={copy.slip.joined} testId="slip-joined">
        <Slip joined className="p-4">
          <p className="type-body">{copy.slip.joinedBody}</p>
        </Slip>
      </Example>
    </Section>
  );
}
