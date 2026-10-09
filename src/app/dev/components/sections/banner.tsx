import type { ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { BannerDemo } from "../demos";
import { MessageIcon } from "../sample-icons";
import { copy, figures, langs, sample, type Lang } from "../sample-data";
import { Example, ScriptBlock, Section } from "./parts";

const undoMessage = (lang: Lang) => sample[lang].banner.undoMessage.replace("{amount}", figures.row);

/** Room on the right for the error banner's 5px shadow, as a screen would leave. */
function Shadowed({ children }: { children: ReactNode }) {
  return <div className="pr-1.5">{children}</div>;
}

export function BannerSection() {
  const en = sample.en.banner;
  const c = copy.banner;
  return (
    <Section id="banner" title={c.title} note={c.note}>
      {langs.map((lang) => {
        const b = sample[lang].banner;
        return (
          <ScriptBlock key={lang} lang={lang}>
            <Example caption={c.offline} testId={`banner-offline-${lang}`}>
              {/* Pulled out to the screen edges: the offline strip is full width. */}
              <div className="-mx-5">
                <Banner kind="offline" title={b.offlineTitle} detail={b.offlineDetail} />
              </div>
            </Example>
            <Example caption={c.error} testId={`banner-error-${lang}`}>
              <Shadowed>
                <Banner kind="error" title={b.errorTitle} detail={b.errorDetail} actions={[{ label: b.retry }, { label: b.later }]} />
              </Shadowed>
            </Example>
            <Example caption={c.undo} testId={`banner-undo-${lang}`}>
              <Banner
                kind="undo"
                message={undoMessage(lang)}
                actions={[{ label: b.undo }, { label: b.sendReceipt, href: "#top", icon: <MessageIcon /> }]}
              />
            </Example>
            <Example caption={c.long} testId={`banner-long-${lang}`}>
              <div className="flex flex-col gap-4">
                <Shadowed>
                  <Banner
                    kind="error"
                    title={b.errorTitle}
                    detail={b.longErrorDetail}
                    actions={[{ label: b.longRetry }, { label: b.longLater }]}
                  />
                </Shadowed>
                <Banner
                  kind="undo"
                  message={undoMessage(lang)}
                  actions={[{ label: b.longUndo }, { label: b.longSend, href: "#top", icon: <MessageIcon /> }]}
                />
              </div>
            </Example>
          </ScriptBlock>
        );
      })}

      <Example caption={c.errorOne} testId="banner-error-one">
        <Shadowed>
          <Banner kind="error" title={en.errorTitle} detail={en.errorDetail} actions={[{ label: en.retry }]} />
        </Shadowed>
      </Example>
      <Example caption={c.errorNone} testId="banner-error-none">
        <Shadowed>
          <Banner kind="error" title={en.errorTitle} detail={en.errorDetail} />
        </Shadowed>
      </Example>
      <Example caption={c.pressed} testId="banner-pressed">
        <div className="flex flex-col gap-4">
          <Shadowed>
            <Banner
              kind="error"
              title={en.errorTitle}
              detail={en.errorDetail}
              actions={[
                { label: en.retry, attrs: { "data-force": "pressed" } },
                { label: en.later, attrs: { "data-force": "pressed" } },
              ]}
            />
          </Shadowed>
          <Banner
            kind="undo"
            message={undoMessage("en")}
            actions={[
              { label: en.undo, attrs: { "data-force": "pressed" } },
              { label: en.sendReceipt, attrs: { "data-force": "pressed" }, icon: <MessageIcon /> },
            ]}
          />
        </div>
      </Example>
      <Example caption={c.focus} testId="banner-focus">
        <div className="flex flex-col gap-4">
          <Banner
            kind="undo"
            message={undoMessage("en")}
            actions={[
              { label: en.undo, attrs: { "data-force": "focus" } },
              { label: en.sendReceipt, attrs: { "data-force": "focus" }, icon: <MessageIcon /> },
            ]}
          />
          <Shadowed>
            <Banner
              kind="error"
              title={en.errorTitle}
              detail={en.errorDetail}
              actions={[{ label: en.retry, attrs: { "data-force": "focus" } }, { label: en.later }]}
            />
          </Shadowed>
        </div>
      </Example>
      <Example caption={c.live} testId="banner-live">
        <BannerDemo
          tapsLabel={c.taps}
          error={{ title: en.errorTitle, detail: en.errorDetail, retry: en.retry, later: en.later }}
          undo={{ message: undoMessage("en"), undo: en.undo, send: en.sendReceipt }}
        />
      </Example>
    </Section>
  );
}
