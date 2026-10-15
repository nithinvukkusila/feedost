// /dev/unlocked/r/?t={token}: the parent's receipt with hi, kn and te unlocked by a test fixture (spec
// parent-pages-english, criterion 10), for the layout tests. The real page is /r/{token}; this one reads the token
// from `?t=` because a static page here has no rewrite. Outside production builds only (next.config.ts).
import { PublicReceipt } from "@/components/receipt/public-receipt";
import { receiptWords } from "@/lib/unlocked-languages";
import { fixtureMetadata, receiptFixture } from "../fixture";

export const metadata = fixtureMetadata;

export default async function UnlockedReceiptPage() {
  return <PublicReceipt words={await receiptWords(receiptFixture)} tokenSource="query" />;
}
