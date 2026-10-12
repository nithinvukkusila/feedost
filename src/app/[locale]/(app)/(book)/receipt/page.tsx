// The tutor's receipt for one fee, named by `?due=` in the address: a static shell, because a static export
// cannot prerender a path per fee. The screen reads the id in the browser. Its words travel on this page
// only: the pay words and the month names, besides what the roster screens need.
import { ClientMessages } from "@/components/i18n/client-messages";
import { ReceiptScreen } from "@/components/pay/receipt-screen";

const namespaces = ["appState", "students", "board", "pay"] as const;

export default function ReceiptPage() {
  return (
    <ClientMessages namespaces={namespaces}>
      <ReceiptScreen />
    </ClientMessages>
  );
}
