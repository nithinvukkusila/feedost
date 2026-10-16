// A template with its `{name}` values filled in, each value set apart as `translate="no"` so a browser's translate
// never rewrites a name, an amount or a UPI ID. `classes` styles a value by its name (the UPI ID in the mono face). The words are plain text; nothing here parses markup.
import { parts } from "@/lib/public-words";

// `langs` gives a value its own `lang` when it is in another language than the template around it.
export function Filled({
  template,
  values,
  classes = {},
  langs = {},
}: Readonly<{ template: string; values: Readonly<Record<string, string>>; classes?: Readonly<Record<string, string>>; langs?: Readonly<Record<string, string>> }>) {
  return (
    <>
      {parts(template, values).map((part, index) => (
        <span
          key={index}
          translate={part.slot === undefined ? undefined : "no"}
          lang={part.slot === undefined ? undefined : langs[part.slot]}
          className={part.slot === undefined ? undefined : classes[part.slot]}
        >
          {part.text}
        </span>
      ))}
    </>
  );
}
