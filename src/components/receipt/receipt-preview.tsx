// The receipt as it will be printed, drawn in HTML so it updates as the tutor types (spec R0-3,
// criterion 22). The PDF is the product; this shows the same words, from the same `receiptLines`.
// A missing value is a ruled gap with a spoken name, never a colour. The stack is the Latin one
// whatever the receipt's language, so the phone's own font draws Indian scripts and no font file is
// fetched for the preview (the PDF fonts are fetched only when the tutor taps).
import type { Locale } from "@/config/locales";
import type { Part, ReceiptLines } from "@/lib/receipt/receipt";
import { guarded } from "@/components/tools/tool-marks";

function Blank({ label, slot }: { label: string; slot: string }) {
  // A ruled gap, with a spoken name so a screen reader does not read "from the family of  by".
  return <span role="img" aria-label={label} data-blank={slot} className="inline-block w-12 border-b-2 border-dashed border-ink align-baseline" />;
}

function Piece({ part, blank }: { part: Part; blank: string }) {
  if (part.kind === "text") return part.text;
  if (part.kind === "blank") return <Blank label={blank} slot={part.slot} />;
  return <span data-slot={part.slot}>{part.text}</span>;
}

export function ReceiptPreview({
  lines,
  lang,
  blank,
  labelledBy,
}: Readonly<{ lines: ReceiptLines; lang: Locale; blank: string; labelledBy: string }>) {
  return (
    <article
      lang={lang}
      translate="no"
      aria-labelledby={labelledBy}
      data-testid="receipt-preview"
      {...guarded}
      className="type-message mr-1.5 border-2 border-ink bg-slip p-4 text-ink shadow-slip select-text"
    >
      <p className="text-2xl leading-snug font-bold wrap-anywhere">{lines.tutor ?? <Blank label={blank} slot="tutor" />}</p>
      <div className="mt-1 flex flex-wrap justify-between gap-x-4 text-sm">
        <p>{lines.title}</p>
        <p>{lines.date}</p>
      </div>
      <p className="mt-3 border-t-2 border-ink pt-3 wrap-anywhere">
        {lines.sentence.map((part, index) => (
          <Piece key={index} part={part} blank={blank} />
        ))}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p data-testid="receipt-amount" className="type-amount max-w-full min-w-0 border-2 border-ink px-3 py-2 text-2xl wrap-anywhere">
          {lines.amount ?? <Blank label={blank} slot="amount" />}
        </p>
        {/* The stamp: a double rule in ink and the word, as on the PDF. A long word in Kannada or Telugu wraps; nothing is cut. */}
        <p data-testid="receipt-stamp" className="min-w-0 border-4 border-double border-ink px-3 py-2 text-center wrap-anywhere">
          <span className="block text-base font-bold">{lines.stamp}</span>
          <span className="block text-sm">{lines.stampDate}</span>
        </p>
      </div>
      <p className="mt-4 text-sm wrap-anywhere">{lines.footer}</p>
    </article>
  );
}
