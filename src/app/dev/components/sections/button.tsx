import { Button, RoundButton } from "@/components/ui/button";
import { BusyDemo } from "../demos";
import { ArrowRightIcon, PlusIcon, SendIcon } from "../sample-icons";
import { copy, indicLangs, sample } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

export function ButtonSection() {
  const en = sample.en;
  const c = copy.states;
  return (
    <Section id="button" title={copy.button.title}>
      <Example caption={copy.button.send} testId="button-send">
        <Button variant="send" full iconStart={<SendIcon />}>
          {en.button.remind}
        </Button>
      </Example>
      <Example caption={copy.button.record} testId="button-record">
        <Button variant="record" full>
          {en.button.markPaid}
        </Button>
      </Example>
      <Example caption={copy.button.outline} testId="button-outline">
        <Button variant="outline" full>
          {en.button.share}
        </Button>
      </Example>

      <Example caption={c.pressed} testId="button-pressed">
        <div className="flex flex-col gap-4">
          <Button variant="send" full data-force="pressed">
            {en.button.remind}
          </Button>
          <Button variant="record" full data-force="pressed">
            {en.button.markPaid}
          </Button>
          <Button variant="outline" full data-force="pressed">
            {en.button.share}
          </Button>
        </div>
      </Example>
      <Example caption={c.focus} testId="button-focus">
        <div className="flex flex-col gap-5 py-1">
          <Button variant="send" full data-force="focus">
            {en.button.remind}
          </Button>
          <Button variant="outline" full data-force="focus">
            {en.button.share}
          </Button>
        </div>
      </Example>
      <Example caption={c.busy} testId="button-busy">
        <Button variant="send" full busy busyLabel={en.button.busy} iconStart={<SendIcon />}>
          {en.button.remind}
        </Button>
      </Example>
      <Example caption={c.tapToBusy} testId="button-busy-demo">
        <BusyDemo label={en.button.remind} busyLabel={en.button.busy} />
      </Example>
      <Example caption={c.disabled} testId="button-disabled">
        <Button variant="send" full disabled disabledReason={en.button.disabledReason}>
          {en.button.remind}
        </Button>
      </Example>
      <Example caption={c.long} testId="button-long">
        <Button variant="send" full iconStart={<SendIcon />}>
          {en.button.long}
        </Button>
      </Example>
      <Example caption={c.icons} testId="button-icons">
        <div className="flex flex-col gap-4">
          <Button variant="record" full iconStart={<PlusIcon />}>
            {en.button.markPaid}
          </Button>
          <Button variant="record" full iconEnd={<ArrowRightIcon />}>
            {en.button.next}
          </Button>
        </div>
      </Example>
      <Example caption={c.link} testId="button-link">
        <Button variant="outline" full href="#top">
          {copy.button.backToTop}
        </Button>
      </Example>

      <Example caption={copy.button.round} testId="button-round">
        <div className="flex flex-wrap items-center gap-5 py-1">
          <RoundButton label={en.button.roundLabel} icon={<SendIcon />} />
          <RoundButton label={en.button.roundLabel} icon={<SendIcon />} data-force="pressed" />
          <RoundButton label={en.button.roundLabel} icon={<SendIcon />} data-force="focus" />
          <RoundButton label={copy.button.backToTop} icon={<ArrowRightIcon />} href="#top" />
        </div>
      </Example>

      <Example caption={c.onCloth} testId="button-on-cloth">
        <div className="on-cloth-ground flex flex-col gap-5 bg-cloth p-5">
          <Button variant="send" full data-force="focus">
            {en.button.remind}
          </Button>
          <Button variant="record" full>
            {en.button.markPaid}
          </Button>
          <Button variant="outline" full>
            {en.button.share}
          </Button>
          <RoundButton label={en.button.roundLabel} icon={<SendIcon />} />
        </div>
      </Example>
      <Example caption={c.onDark} testId="button-on-dark">
        <div className="on-dark-ground flex flex-col gap-5 bg-sheet-ground p-5">
          <Button variant="outline" full data-force="focus">
            {en.button.share}
          </Button>
        </div>
      </Example>

      {indicLangs.map((lang) => {
        const s = sample[lang];
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Button variant="send" full iconStart={<SendIcon />}>
              {s.button.remind}
            </Button>
            <Button variant="record" full>
              {s.button.markPaid}
            </Button>
            <Button variant="outline" full>
              {s.button.share}
            </Button>
            <Example caption={c.long}>
              <Button variant="send" full iconStart={<SendIcon />}>
                {s.button.long}
              </Button>
            </Example>
            <Example caption={c.busy}>
              <Button variant="send" full busy busyLabel={s.button.busy}>
                {s.button.remind}
              </Button>
            </Example>
            <Example caption={c.disabled}>
              <Button variant="send" full disabled disabledReason={s.button.disabledReason}>
                {s.button.remind}
              </Button>
            </Example>
          </ScriptBlock>
        );
      })}
    </Section>
  );
}
