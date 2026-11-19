import type { Metadata } from "next";
import { SignIn } from "@/components/pages/signin/SignIn";

export const metadata: Metadata = {
  title: "Sign in or sign up",
  description: "Sign in to pacr, or make your free account, with Apple, Google, or your email and a six-digit code.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <SignIn />;
}
