// "/p/{token}": one static shell for every pay-page link (a Vercel rewrite serves it for any token). The words of each
// unlocked language are in the page (English, and any language a named person has signed: spec parent-pages-english)
// because the language comes from the student, not from the address; the month and subject names are the receipt's,
// so only those keys of it travel here. A locked language's words are not in the shell at all. No
// generateStaticParams: a token cannot be known at build time.
import { PublicPayPage } from "@/components/pay-page/public-pay-page";
import { payPageWords } from "@/lib/unlocked-languages";

export default async function PayPageRoute() {
  return <PublicPayPage words={await payPageWords()} />;
}
