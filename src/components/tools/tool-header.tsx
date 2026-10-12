// The cloth bar at the top of a free tool's page: the product name as a link back to the landing in
// the same language, and the two tools. The tool you are on is a word with a highlight, marked
// `aria-current="page"`, and is not a link; the other is a plain link to its page (spec R0-3, criterion 6).
import { useLocale, useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { feeReceiptPath, feeReminderPath, localeHref } from "@/config/routes";

export type Tool = "receipt" | "reminder";

const paths: Record<Tool, string> = { receipt: feeReceiptPath, reminder: feeReminderPath };
const order: readonly Tool[] = ["receipt", "reminder"];

export function ToolHeader({ current }: Readonly<{ current: Tool }>) {
  const locale = useLocale();
  const t = useTranslations("toolNav");
  const base = "flex min-h-tap min-w-tap items-center";
  return (
    <header className="on-cloth-ground border-b-2 border-ink bg-cloth text-on-cloth outline-2 -outline-offset-6 outline-stitch outline-dashed">
      <div className="mx-auto flex w-full max-w-2xl lg:max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5">
        <a href={localeHref(locale)} className={`type-headline ${base} text-2xl ring:ground-ring`}>
          {brand.name}
        </a>
        <nav aria-label={t("label")}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {order.map((tool) => (
              <li key={tool}>
                {tool === current ? (
                  <span aria-current="page" className={`${base} type-body bg-highlight px-3 font-bold text-ink`}>
                    {t(tool)}
                  </span>
                ) : (
                  <a href={localeHref(locale, paths[tool])} className={`${base} type-body font-bold underline ring:ground-ring`}>
                    {t(tool)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
