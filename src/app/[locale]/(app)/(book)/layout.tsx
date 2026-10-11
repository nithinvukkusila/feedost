// The screens that show the tutor's students (spec R1-3): home, the student and batch screens and
// attendance. They share one cached roster, held here, so moving between them shows the lists at once.
// Screens outside this group (More, setup) never load the roster code or these words, so they do not grow.
// The inner provider replaces the outer one's words, so the list names everything these screens use.
import { ClientMessages } from "@/components/i18n/client-messages";
import { RosterProvider } from "@/components/app/roster";

const namespaces = ["appState", "home", "nav", "students", "batches", "attendance"] as const;

export default function BookLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClientMessages namespaces={namespaces}>
      <RosterProvider>{children}</RosterProvider>
    </ClientMessages>
  );
}
