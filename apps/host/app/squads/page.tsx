import type { Metadata } from "next";
import SquadsList from "./SquadsList";

export const metadata: Metadata = { title: "Squads — PACR Host" };

export default function SquadsPage() {
  return (
    <main className="wrap">
      <div className="page-head">
        <h1 className="h1">Your squads</h1>
        <p className="lede">
          The squads you can run as a run leader, organiser or owner. Members, runs, messages and insights
          for each squad will live here.
        </p>
      </div>
      <SquadsList />
    </main>
  );
}
