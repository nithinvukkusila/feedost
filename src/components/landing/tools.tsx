// Section 4: the two free tools. They do not exist yet, so the cards say "Coming soon" and are not
// links. R0-2 turns card 2 into a link to the reminder writer; R0-3 turns card 1 into a link to the receipt maker.
import { useTranslations } from "next-intl";
import { Slip } from "@/components/ui/slip";

type Tool = "t1" | "t2";
const cards: Tool[] = ["t1", "t2"];

export function Tools() {
  const t = useTranslations("landing.tools");
  return (
    <section id="tools" aria-labelledby="tools-title" className="mx-auto w-full max-w-2xl px-5 pt-16">
      <h2 id="tools-title" className="type-headline text-4xl wrap-break-word">
        {t("title")}
      </h2>
      <ul className="mt-6 flex flex-col gap-6 pr-1.5">
        {cards.map((tool) => (
          <li key={tool}>
            <Slip as="article" className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className="type-label text-cloth">{t(`${tool}.no`)}</p>
                {/* A word with a dashed outline: the mark is the outline, not the colour. */}
                <p className="type-label border-2 border-dashed border-ink-label px-2 py-1 text-ink-soft">{t("tag")}</p>
              </div>
              <h3 className="type-headline text-3xl wrap-break-word">{t(`${tool}.title`)}</h3>
              <p className="type-body text-ink-soft">{t(`${tool}.body`)}</p>
            </Slip>
          </li>
        ))}
      </ul>
    </section>
  );
}
