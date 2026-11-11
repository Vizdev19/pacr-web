import type { Metadata } from "next";
import { ErrorState } from "@/components/ds/feedback";

export const metadata: Metadata = { title: { absolute: "An event on pacr" }, description: "Open this link in the pacr app to see the event.", robots: { index: false } };

/** A malformed /e/<ref>: the link was cut short or mistyped. */
export default function NotFound() {
  return <div className="pw-container sec"><ErrorState kind="notfound" title="We can't find that event" body="The link may be cut short or mistyped. Ask whoever shared it to send it again." action="See events" href="/events" /></div>;
}
