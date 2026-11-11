import { redirect } from "next/navigation";

/** /activity on its own → your profile, where recent runs link to each run. */
export default function Page() {
  redirect("/profile");
}
