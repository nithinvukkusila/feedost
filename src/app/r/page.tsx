// "/r/{token}": one static shell for every receipt link (a Vercel rewrite serves it for any token). The words of each
// unlocked language are in the page (English, and any language a named person has signed: spec parent-pages-english)
// because the language comes from the receipt, not from the address. A locked language's words are not in the shell.
// No generateStaticParams: a token cannot be known at build time.
import { PublicReceipt } from "@/components/receipt/public-receipt";
import { receiptWords } from "@/lib/unlocked-languages";

export default async function ReceiptPage() {
  return <PublicReceipt words={await receiptWords()} />;
}
