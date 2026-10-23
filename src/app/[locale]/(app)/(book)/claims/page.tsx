// The inbox of parents' "I've paid" claims (R1-10): reached from Home's chip. Its words travel on this page
// only: the claims words, and the pay and board words the Undo banner and the month names need, besides
// what the roster screens need. The inner provider replaces the layout's words, so it names everything this screen uses.
import { ClientMessages } from "@/components/i18n/client-messages";
import { ClaimsScreen } from "@/components/claims/claims-screen";

const namespaces = ["appState", "nav", "students", "board", "pay", "claims"] as const;

export default function ClaimsPage() {
  return (
    <ClientMessages namespaces={namespaces}>
      <ClaimsScreen />
    </ClientMessages>
  );
}
