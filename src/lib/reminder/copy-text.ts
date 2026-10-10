// Copy to the clipboard (spec R0-2, criteria 43 and 44). The Clipboard API first; inside older in-app
// browsers, where it is missing or refused, a hidden textarea and the old copy command. It answers
// true or false and never rejects, so a failed copy leads to a message on the page, not a crash.

function copyWithTextarea(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.readOnly = true;
  area.setAttribute("aria-hidden", "true");
  area.tabIndex = -1;
  // Off-screen but still selectable; `fixed` so appending it cannot scroll the page.
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused or blocked: try the older way.
  }
  try {
    return copyWithTextarea(text);
  } catch {
    return false;
  }
}
