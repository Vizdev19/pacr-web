import type { Metadata } from "next";
import { SignIn } from "@/components/pages/signin/SignIn";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to pacr with Apple, Google, or the email on your account and a six-digit code.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <SignIn />;
}
