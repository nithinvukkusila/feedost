// The home screen: the empty book of a tutor with no students yet. The gate in the layout decides, in the
// browser, whether this shows, or the tutor goes to sign-in or to the open setup step.
import { EmptyHome } from "@/components/home/empty-home";

export default function HomePage() {
  return <EmptyHome />;
}
