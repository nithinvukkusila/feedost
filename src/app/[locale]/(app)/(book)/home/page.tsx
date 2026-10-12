// The home screen: the empty book of a tutor with no students yet, or the dues board of one with some. The
// gate in the layout decides, in the browser, whether this shows, or the tutor goes to sign-in or to the open
// setup step; the roster decides which home. The board's words travel on this page only, not on the student
// and batch pages; the inner provider replaces the layout's words, so it names everything this screen uses.
import { ClientMessages } from "@/components/i18n/client-messages";
import { HomeScreen } from "@/components/home/home-screen";

const namespaces = ["appState", "home", "nav", "students", "board", "pay"] as const;

export default function HomePage() {
  return (
    <ClientMessages namespaces={namespaces}>
      <HomeScreen />
    </ClientMessages>
  );
}
