// "/r/{token}": one static shell for every receipt link (a Vercel rewrite serves it for any token). The words of
// the four languages are in the page because the language comes from the receipt, not from the address.
// No generateStaticParams: a token cannot be known at build time.
import { PublicReceipt } from "@/components/receipt/public-receipt";
import { getAllWords } from "@/i18n/words";

export default async function ReceiptPage() {
  return <PublicReceipt words={await getAllWords("receipt")} />;
}
