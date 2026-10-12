// One student, named by `?id=` in the address: a static shell, because a static export cannot prerender a
// path per student. The screen reads the id in the browser.
import { StudentEditScreen } from "@/components/students/student-edit-screen";

export default function StudentEditPage() {
  return <StudentEditScreen />;
}
