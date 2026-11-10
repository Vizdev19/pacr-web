import { redirect } from "next/navigation";

// On pacr.life, /host itself is still the original events page (host.html);
// only the paths listed in pacr.life's vercel.json reach this app. Opened
// directly on its own Vercel URL, /host goes to the first page built here.
export default function Home() {
  redirect("/squads");
}
