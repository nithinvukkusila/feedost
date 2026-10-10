// Where a tutor goes once they are signed in: the sign-in screen (already signed in) and the callback
// (just signed in) both ask here. Home for a finished profile, the open setup step otherwise. If the
// tutor's row cannot be read (the network), home: its gate shows the error and the retry.
import type { Place } from "@/config/routes";
import { nextRoute } from "./profile";
import { getTutor } from "./tutor";

export async function placeAfterSignIn(): Promise<Place> {
  try {
    const tutor = await getTutor();
    if (tutor === null) return "home";
    const decision = nextRoute({ session: "signed-in", profile: tutor, place: "sign-in" });
    return decision.action === "go" ? decision.to : "home";
  } catch {
    return "home";
  }
}
