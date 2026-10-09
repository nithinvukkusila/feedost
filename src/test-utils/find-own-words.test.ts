import { describe, expect, it } from "vitest";
import { findOwnWords } from "./find-own-words";

describe("findOwnWords", () => {
  it("flags JSX text, string children and spoken attributes", () => {
    expect(findOwnWords("const a = <button>Save</button>;")).toEqual(['text "Save"']);
    expect(findOwnWords('const a = <p>{"Saved"}</p>;')).toEqual(['text "Saved"']);
    expect(findOwnWords('const a = <button aria-label="Close" />;')).toEqual(['aria-label="Close"']);
    expect(findOwnWords('const a = <input placeholder={"name@bank"} />;')).toEqual(['placeholder="name@bank"']);
    expect(findOwnWords("const a = <p>जमा</p>;")).toEqual(['text "जमा"']);
  });

  it("follows a string through a condition, a fallback and a template", () => {
    expect(findOwnWords('const a = <button>{open ? "Close" : "Open"}</button>;')).toEqual(['text "Close"', 'text "Open"']);
    expect(findOwnWords('const a = <p>{busy && "Saving"}</p>;')).toEqual(['text "Saving"']);
    expect(findOwnWords('const a = <p>{label ?? "Untitled"}</p>;')).toEqual(['text "Untitled"']);
    expect(findOwnWords("const a = <p>{`Step ${n}`}</p>;")).toEqual(['text "Step "']);
    expect(findOwnWords('const a = <button aria-label={open ? "Close" : label} />;')).toEqual(['aria-label="Close"']);
  });

  it("follows a module constant used by name", () => {
    expect(findOwnWords('const LABEL = "Close";\nconst a = <button aria-label={LABEL} />;')).toEqual(['aria-label="Close"']);
    expect(findOwnWords('const WORD = "Paid";\nconst a = <span>{WORD}</span>;')).toEqual(['text "Paid"']);
    expect(findOwnWords('const A = B;\nconst B = "Loop";\nconst a = <span>{A}</span>;')).toEqual(['text "Loop"']);
    // Class-name constants are not words shown to anyone.
    expect(findOwnWords('const base = "flex items-center";\nconst a = <span className={base}>{children}</span>;')).toEqual([]);
  });

  it("allows passed-in text, class names, roles, spacing and comments", () => {
    const source = `
      const a = (
        <button type="button" role="tab" className="type-label" aria-hidden="true" aria-label={label}>
          {/* a comment with words */}
          {children}{" "}
          <span>{count}</span>
        </button>
      );`;
    expect(findOwnWords(source)).toEqual([]);
  });
});

