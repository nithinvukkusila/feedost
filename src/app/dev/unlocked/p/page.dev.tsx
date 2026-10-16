// /dev/unlocked/p/?t={token}: the parent's pay page with hi, kn and te unlocked by a test fixture (spec
// parent-pages-english, criterion 10), for the layout tests. The real page is /p/{token}; this one reads the token
// from `?t=` because a static page here has no rewrite. Outside production builds only (next.config.ts).
import { PublicPayPage } from "@/components/pay-page/public-pay-page";
import { payPageWords } from "@/lib/unlocked-languages";
import { fixtureMetadata, payPageFixture } from "../fixture";

export const metadata = fixtureMetadata;

export default async function UnlockedPayPage() {
  return <PublicPayPage words={await payPageWords(payPageFixture)} tokenSource="query" />;
}
