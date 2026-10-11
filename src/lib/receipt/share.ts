// Download and Share for the receipt PDF (spec R0-3, criteria 23 and 25). No PDF library here: this
// file only handles a finished Blob, so it can be imported statically. On a phone that can share a
// file, the share sheet opens with the PDF attached. Where it cannot, the PDF is saved and WhatsApp
// opens with a short text; the tutor attaches the file. Cancelling the share sheet is not an error.
import { chooseShare } from "./receipt";

export type ShareOutcome = "shared" | "cancelled" | "saved";

/** What the browser provides; replaced in tests. */
export type ShareEnv = {
  /** `navigator.canShare`, or `undefined` where it does not exist. */
  canShare?: (data: { files: File[] }) => boolean;
  /** `navigator.share`, or `undefined` where it does not exist. */
  share?: (data: { files: File[]; text?: string }) => Promise<void>;
  /** Saves the file to the phone. */
  save: (blob: Blob, fileName: string) => void;
  /** Opens an address in a new tab. */
  open: (url: string) => void;
};

/** Saves a Blob as a file: a link with `download`, tapped once, then the address is let go. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Let go of the file's address once the browser has taken the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function browserEnv(): ShareEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    canShare: nav && typeof nav.canShare === "function" ? (data) => nav.canShare(data) : undefined,
    share: nav && typeof nav.share === "function" ? (data) => nav.share(data) : undefined,
    save: saveBlob,
    open: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  };
}

/** Whether this browser can share a file, asked with a real file of the right type. Used to choose the label and path. */
export function canShareFiles(blob: Blob, fileName: string, env: ShareEnv = browserEnv()): boolean {
  if (!env.canShare || !env.share) return false;
  try {
    return env.canShare({ files: [new File([blob], fileName, { type: blob.type })] });
  } catch {
    return false;
  }
}

/** Download only: saves the PDF. */
export function download(blob: Blob, fileName: string, env: ShareEnv = browserEnv()): void {
  env.save(blob, fileName);
}

/**
 * Share: the share sheet where the browser can attach a file, otherwise save the PDF and open
 * WhatsApp with `whatsAppUrl`. A share that fails for any reason except being cancelled falls back
 * the same way: some Androids say yes to `canShare` and then refuse.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  text: string,
  whatsAppUrl: string,
  env: ShareEnv = browserEnv(),
): Promise<ShareOutcome> {
  if (chooseShare({ canShareFiles: canShareFiles(blob, fileName, env) }) === "share-file" && env.share) {
    try {
      await env.share({ files: [new File([blob], fileName, { type: blob.type })], text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      if (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError") return "cancelled";
      // Any other refusal: fall through to the save and the WhatsApp text.
    }
  }
  env.save(blob, fileName);
  env.open(whatsAppUrl);
  return "saved";
}
