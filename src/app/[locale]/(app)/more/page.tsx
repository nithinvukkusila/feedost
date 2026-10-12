// More: the tutor's profile, the language and Sign out, with the bottom nav. A prerendered shell inside the app gate.
// The nav's four words travel with it; the roster and its words stay out (this screen does not read students).
import { ClientMessages } from "@/components/i18n/client-messages";
import { MoreScreen } from "@/components/more/more-screen";

const namespaces = ["more", "subjects", "nav"] as const;

export default function MorePage() {
  return (
    <ClientMessages namespaces={namespaces}>
      <MoreScreen />
    </ClientMessages>
  );
}
