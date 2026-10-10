// Where a tutor goes once they are signed in: the sign-in screen (already signed in) and the callback
// (just signed in) both ask here. Temporary, until setup exists: every tutor goes home.
import type { Place } from "@/config/routes";

export async function placeAfterSignIn(): Promise<Place> {
  return "home";
}
