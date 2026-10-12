// Spec R1-8, criterion 31 (review): everything on the Remind screen that holds a name, the question sheet
// included, sits inside the element marked for the error reporter and analytics to leave alone.
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithWords } from "@/test-utils/render-with-words";
import type { QueueItem } from "@/lib/reminder-rules";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u", upiId: "meena@okhdfc", name: "Meena Iyer" } }) }));
const remind = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./remind-provider", () => ({ useRemind: () => remind.value }));

import { RemindRun } from "./remind-run";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

const item = (n: number): QueueItem => ({
  dueId: `d${n}`,
  studentId: `s${n}`,
  studentName: `Student${n} Zed`,
  parentName: `Parentname${n} Qux`,
  parentPhone: "+919876543210",
  parentLanguage: "en",
  batchName: "Batch",
  month: "2026-10-01",
  kind: "monthly",
  daysLate: 7,
  remaining: 100000,
  dueDate: "2026-10-05",
});

describe("the Remind screen's privacy marks", () => {
  it("every element holding a student's or parent's name has the marked wrapper as an ancestor, the question sheet included", async () => {
    remind.value = { tone: "polite", setTone: vi.fn(), clear: vi.fn(), log: { subscribe: () => () => {}, get: () => 0, isPending: () => false, log: vi.fn(), flush: vi.fn() } };
    // Reminded 30 minutes before the clock the screen reads, so the question is asked.
    const last = { d1: Date.now() - 30 * 60_000 };
    renderWithWords(<RemindRun queue={[item(1), item(2)]} last={last} />);
    const check = () => {
      const holders = [...document.querySelectorAll("body *")].filter((el) => /Student\d Zed|Parentname\d Qux/.test([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("")));
      expect(holders.length).toBeGreaterThan(0);
      for (const el of holders) {
        expect(el.closest("[data-ph-no-capture][data-sentry-mask]"), el.outerHTML.slice(0, 80)).not.toBeNull();
      }
    };
    expect(screen.getByRole("dialog")).toBeTruthy();
    check();
    await userEvent.click(screen.getAllByRole("button", { name: "Remind again" })[0]);
    check();
  });
});
