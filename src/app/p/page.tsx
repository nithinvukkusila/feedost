// "/p/{token}": one static shell for every pay-page link (a Vercel rewrite serves it for any token). The words of the
// four languages are in the page because the language comes from the student, not from the address; the month and
// subject names are the receipt's, so only those keys of it travel here. No generateStaticParams: a token cannot be
// known at build time.
import { PublicPayPage } from "@/components/pay-page/public-pay-page";
import { getAllWords } from "@/i18n/words";
import { pageWords } from "@/lib/pay-page-words";

export default async function PayPageRoute() {
  return <PublicPayPage words={pageWords(await getAllWords("payPage"), await getAllWords("receipt"))} />;
}
