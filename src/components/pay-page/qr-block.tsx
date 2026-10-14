"use client";

// The QR code, opened under the Pay area (spec R1-9 criteria 43 and 44). It draws the very `upi://pay` string the Pay
// button links to, on this phone: the encoder is fetched once, on the first tap, by `qrMatrix`, and nothing about the
// payment goes anywhere. One SVG path, ink on the lightest paper, a quiet border of 4 modules, 256px at normal text size, 204px at 200% text (it shrinks with the viewport, never clipped).
import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { qrMatrix, type QrMatrix } from "@/lib/qr";
import type { PayPageWords } from "@/lib/pay-page-words";

const QUIET = 4;

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
      <div className="aspect-square w-full max-w-64 border-2 border-ink bg-slip">
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
