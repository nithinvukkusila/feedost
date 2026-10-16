"use client";

// The QR code, opened under the Pay area (spec R1-9 criteria 43 and 44). It draws the very `upi://pay` string the Pay
// button links to, on this phone: the encoder is fetched once, on the first tap, by `qrMatrix`, and nothing about the
// payment goes anywhere. One SVG path, ink on the lightest paper, a quiet border of 4 modules,
// 256px at normal text size and never under QR_MIN_PX (criterion 43, founder 2026-10-16: 220px at every text size). At
// 200% text the column is narrower than that, so the box spreads a few px into the side margins; the page still never
// scrolls sideways (e2e/pay-page-qr.spec.ts).
import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { qrMatrix, type QrMatrix } from "@/lib/qr";
import type { PayPageWords } from "@/lib/pay-page-words";

const QUIET = 4;

/** The smallest the drawn QR code may be, in CSS px, at any text size (criterion 43). The e2e test imports it. */
export const QR_MIN_PX = 220;
/** The box's `border-2`, each side. The box is border-box, so its floor adds both sides and the code itself keeps QR_MIN_PX. */
const BORDER_PX = 2;

type State = { kind: "drawing" } | { kind: "drawn"; matrix: QrMatrix } | { kind: "failed" };

export function QrBlock({ text, upiId, words, onClose }: Readonly<{ text: string; upiId: string; words: PayPageWords; onClose: () => void }>) {
  const [state, setState] = useState<State>({ kind: "drawing" });
  useEffect(() => {
    let live = true;
    qrMatrix(text).then(
      (matrix) => {
        if (live) setState({ kind: "drawn", matrix });
      },
      () => {
        if (live) setState({ kind: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [text]);

  const close = (
    <div className="pr-1.5">
      <Button variant="outline" full onClick={onClose}>
        {words.qrClose}
      </Button>
    </div>
  );

  if (state.kind === "failed") {
    return (
      <div className="mt-4 flex flex-col gap-3" data-qr="failed">
        <div role="alert">
          <Banner kind="error" title={words.qrFailed} detail={null} />
        </div>
        {close}
      </div>
    );
  }
  const box = state.kind === "drawn" ? state.matrix.size + QUIET * 2 : 1;
  return (
    <div className="mt-4 flex flex-col items-center gap-3" data-qr={state.kind}>
      <div className="aspect-square w-full max-w-64 border-2 border-ink bg-slip" style={{ minWidth: QR_MIN_PX + BORDER_PX * 2 }}>
        {state.kind === "drawn" ? (
          <svg viewBox={`0 0 ${String(box)} ${String(box)}`} role="img" aria-label={words.qrHelp} shapeRendering="crispEdges" className="size-full text-ink">
            <rect width={box} height={box} className="fill-slip" />
            <path d={state.matrix.path} transform={`translate(${String(QUIET)} ${String(QUIET)})`} fill="currentColor" />
          </svg>
        ) : null}
      </div>
      <p className="type-body-sm text-center wrap-anywhere">{words.qrHelp}</p>
      <p translate="no" className="type-amount-row text-center break-all">
        {upiId}
      </p>
      <div className="w-full">{close}</div>
    </div>
  );
}
