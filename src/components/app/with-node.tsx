// A sentence with something other than text in the middle of it: "₹1,200 on the 5th" where the amount is
// set in its own face. The message is asked for with a private marker where the node goes, so each language
// keeps its own word order, and the text is cut at the marker.
import type { ReactNode } from "react";

const MARK = "";

/** `say` is given the marker to pass as the message's argument; the node takes its place in the text it returns. */
export function withNode(say: (marker: string) => string, node: ReactNode): ReactNode {
  const [before, ...rest] = say(MARK).split(MARK);
  return (
    <>
      {before}
      {rest.length > 0 ? node : null}
      {rest.join("")}
    </>
  );
}
