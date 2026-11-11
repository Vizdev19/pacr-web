import { ErrorState } from "@/components/ds/feedback";

export default function NotFound() {
  return <div className="pw-container sec"><ErrorState kind="notfound" action="Go home" href="/" /></div>;
}
