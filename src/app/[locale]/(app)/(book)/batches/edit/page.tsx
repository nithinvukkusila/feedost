// One batch, named by `?id=` in the address: a static shell, because a static export cannot prerender a
// path per batch. The screen reads the id in the browser.
import { BatchScreen } from "@/components/batches/batch-screen";

export default function BatchEditPage() {
  return <BatchScreen />;
}
