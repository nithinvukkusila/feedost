// The Remind screen (R1-8): a static shell. Which fees are queued is held in memory in the book layout, so the
// address carries nothing about a student. Its words travel on this page only: the screen's own, the row
// words it shares with the board, the month names, and what the roster screens need.
import { ClientMessages } from "@/components/i18n/client-messages";
import { RemindScreen } from "@/components/remind/remind-screen";

const namespaces = ["appState", "students", "board", "remind", "remindScreen"] as const;

export default function RemindPage() {
  return (
    <ClientMessages namespaces={namespaces}>
      <RemindScreen />
    </ClientMessages>
  );
}
