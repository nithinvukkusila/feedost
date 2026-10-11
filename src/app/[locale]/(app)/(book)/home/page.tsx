// The home screen: the empty book of a tutor with no students yet, or the home of one with some. The gate
// in the layout decides, in the browser, whether this shows, or the tutor goes to sign-in or to the open
// setup step; the roster decides which home.
import { HomeScreen } from "@/components/home/home-screen";

export default function HomePage() {
  return <HomeScreen />;
}
