// The cloth bar at the top of the landing page: the product name and a small button to the waitlist.
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export function LandingHeader() {
  const t = useTranslations("landing.header");
  return (
    <header className="on-cloth-ground bg-cloth text-on-cloth">
      <div className="mx-auto flex w-full max-w-2xl lg:max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
        <p className="type-headline text-3xl">{brand.name}</p>
        <Button variant="outline" href="#waitlist">
          {t("join")}
        </Button>
      </div>
    </header>
  );
}
