// Download and Share (spec R0-3, criterion 25): the share sheet where a file can be shared, the
// save-and-WhatsApp path where it cannot, and a cancelled sheet is not an error.
import { describe, expect, it, vi } from "vitest";
import { canShareFiles, download, saveBlob, shareOrDownload, type ShareEnv } from "./share";

const blob = new Blob(["%PDF-"], { type: "application/pdf" });
const NAME = "fee-receipt-Oct-2026.pdf";
const WA = "https://wa.me/?text=hello";

function env(over: Partial<ShareEnv> = {}) {
  const calls = { saved: [] as string[], opened: [] as string[], shared: [] as { files: File[]; text?: string }[] };
  const full: ShareEnv = {
    canShare: () => true,
    share: async (data) => {
      calls.shared.push(data);
    },
    save: (_blob, name) => calls.saved.push(name),
    open: (url) => calls.opened.push(url),
    ...over,
  };
  return { env: full, calls };
}

describe("canShareFiles", () => {
  it("is true when the browser says it can share a PDF file", () => {
    const canShare = vi.fn(() => true);
    expect(canShareFiles(blob, NAME, env({ canShare }).env)).toBe(true);
    const asked = (canShare.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0];
    expect(asked.name).toBe(NAME);
    expect(asked.type).toBe("application/pdf");
  });

  it("is false where canShare or share is missing, says no, or throws", () => {
    expect(canShareFiles(blob, NAME, env({ canShare: undefined }).env)).toBe(false);
    expect(canShareFiles(blob, NAME, env({ share: undefined }).env)).toBe(false);
    expect(canShareFiles(blob, NAME, env({ canShare: () => false }).env)).toBe(false);
    expect(
      canShareFiles(
        blob,
        NAME,
        env({
          canShare: () => {
            throw new TypeError("no");
          },
        }).env,
      ),
    ).toBe(false);
  });
});

describe("shareOrDownload", () => {
  it("opens the share sheet with the file and the text, and saves nothing", async () => {
    const { env: e, calls } = env();
    expect(await shareOrDownload(blob, NAME, "hello", WA, e)).toBe("shared");
    expect(calls.shared).toHaveLength(1);
    expect(calls.shared[0].files[0].name).toBe(NAME);
    expect(calls.shared[0].text).toBe("hello");
    expect(calls.saved).toEqual([]);
    expect(calls.opened).toEqual([]);
  });

  it("is not an error when the tutor cancels the sheet: nothing saved, nothing opened", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    const { env: e, calls } = env({
      share: async () => {
        throw abort;
      },
    });
    expect(await shareOrDownload(blob, NAME, "hello", WA, e)).toBe("cancelled");
    expect(calls.saved).toEqual([]);
    expect(calls.opened).toEqual([]);
  });

  it("saves the file and opens WhatsApp where files cannot be shared", async () => {
    const { env: e, calls } = env({ canShare: () => false });
    expect(await shareOrDownload(blob, NAME, "hello", WA, e)).toBe("saved");
    expect(calls.shared).toEqual([]);
    expect(calls.saved).toEqual([NAME]);
    expect(calls.opened).toEqual([WA]);
  });

  it("falls back the same way when canShare said yes and share then refused for another reason", async () => {
    const { env: e, calls } = env({
      share: async () => {
        throw new DOMException("not allowed", "NotAllowedError");
      },
    });
    expect(await shareOrDownload(blob, NAME, "hello", WA, e)).toBe("saved");
    expect(calls.saved).toEqual([NAME]);
    expect(calls.opened).toEqual([WA]);
  });
});

describe("download and saveBlob", () => {
  it("download hands the file to save, and nothing else happens", () => {
    const { env: e, calls } = env();
    download(blob, NAME, e);
    expect(calls.saved).toEqual([NAME]);
    expect(calls.opened).toEqual([]);
  });

  it("saveBlob taps one link with a download name and lets go of the address", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(`${this.download} ${this.href}`);
    });
    saveBlob(blob, NAME);
    expect(clicked).toEqual([`${NAME} blob:test`]);
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:test");
    spy.mockRestore();
    vi.useRealTimers();
  });
});
