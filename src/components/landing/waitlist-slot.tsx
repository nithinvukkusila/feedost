// THE WAITLIST PLACEHOLDER. Slice R0-4 replaces the body of this one file with the real form and
// then removes `landing.waitlist.soon`, `.button` and `.reason` from all four message files.
// Keep the section (`id="waitlist"`, its heading and paragraph) in src/app/[locale]/page.tsx: the
// header and hero buttons already point at #waitlist.
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";

export function WaitlistSlot() {
  const t = useTranslations("landing.waitlist");
  return (
    <Slip className="mt-6 flex flex-col gap-4 mr-1.5 p-4">
      <p className="type-body">{t("soon")}</p>
      <Button variant="record" disabled full disabledReason={t("reason")}>
        {t("button")}
      </Button>
    </Slip>
  );
}
