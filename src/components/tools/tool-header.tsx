// The cloth bar at the top of a free tool's page: the product name as a link back to the landing
// in the same language. No other link yet: R0-3 adds the link between the two tools here.
import { useLocale } from "next-intl";
import { brand } from "@/config/brand";
import { localeHref } from "@/config/routes";

export function ToolHeader() {
  const locale = useLocale();
  return (
    <header className="on-cloth-ground border-b-2 border-ink bg-cloth text-on-cloth outline-2 -outline-offset-6 outline-stitch outline-dashed">
      <div className="mx-auto flex w-full max-w-2xl lg:max-w-7xl flex-wrap items-center px-5 py-2.5">
        <a href={localeHref(locale)} className="type-headline flex min-h-tap min-w-tap items-center text-2xl ring:ground-ring">
          {brand.name}
        </a>
      </div>
    </header>
  );
}
