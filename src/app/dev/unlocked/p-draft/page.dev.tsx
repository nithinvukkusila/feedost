// /dev/unlocked/p-draft/?t={token}: the parent's pay page with hi, kn and te unlocked by a test fixture but the consent
// wording still a draft, so the consent lines are English inside those languages (spec parent-pages-english, section 3
// and criteria 4 and 10). For the layout tests of that mix. Outside production builds only (next.config.ts).
import { PublicPayPage } from "@/components/pay-page/public-pay-page";
import { payPageWords } from "@/lib/unlocked-languages";
import { fixtureMetadata, payPageDraftConsentFixture } from "../fixture";

export const metadata = fixtureMetadata;

export default async function UnlockedDraftConsentPayPage() {
  return <PublicPayPage words={await payPageWords(payPageDraftConsentFixture)} tokenSource="query" />;
}
