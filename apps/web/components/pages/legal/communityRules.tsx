// /community-rules: community-rules.html's text, word for word. The five
// rules keep their numbers; the two closing sections and the meta line follow.
import { P, type LegalDoc } from "./Legal";

export const COMMUNITY_RULES: LegalDoc = {
  overline: "Community rules",
  title: "Cheer, don't sneer.",
  lede: <>Pacr&apos;s feed is for runners cheering each other on. Five rules keep it that way. Breaking them gets the post removed and can get the account closed — we don&apos;t run a warning system for abuse.</>,
  sections: [
    {
      id: "no-abuse", nav: "No abuse, ever", num: "01", title: "No abuse, ever",
      body: <P>No harassment, threats, hate speech, or slurs — about anyone, in a post, a comment, a photo or a squad name. There is no warning system for this. Posts go, and accounts go with them.</P>,
    },
    {
      id: "nothing-sexual", nav: "Nothing sexual", num: "02", title: "Nothing sexual",
      body: <P>No sexual or explicit content, and nothing involving minors. Photos included.</P>,
    },
    {
      id: "no-spam", nav: "No spam or scams", num: "03", title: "No spam or scams",
      body: <P>Don&apos;t sell things, farm follows, or post links you wouldn&apos;t send a friend.</P>,
    },
    {
      id: "own-runs", nav: "Post your own runs", num: "04", title: "Post your own runs",
      body: <P>Share runs you actually did, and photos you actually took. Don&apos;t post someone else&apos;s picture or a route that isn&apos;t yours.</P>,
    },
    {
      id: "respect-squad", nav: "Respect the squad", num: "05", title: "Respect the squad",
      body: <P>A squad is somebody&apos;s room. Owners can remove posts and members, and set the feed to owners-only. Public clubs are open to anyone, so hold them to the same standard.</P>,
    },
    {
      id: "report", nav: "If you see something", title: "If you see something",
      body: <>
        <P><strong>In the app</strong>, long-press any post or comment. <strong>On the web</strong>, open the <span aria-label="more">···</span> menu on the post. Either way you can report it or block whoever wrote it.</P>
        <P>Reporting hides it from you straight away and sends it to the squad owner to review. Blocking is immediate and mutual: neither of you sees the other&apos;s posts or comments, and they can&apos;t comment on or like yours. Undo a block any time from Profile → Blocked accounts in the app.</P>
        <P>We review every report. Anything abusive comes down, and the account behind it can be removed.</P>
      </>,
    },
    {
      id: "contact", nav: "Contact us", title: "Contact us",
      body: <>
        <P>Something urgent, or a report you think we&apos;ve missed? Email us and we&apos;ll come back to you.</P>
        <P><a className="t-h4" href="mailto:support@pacr.life?subject=Pacr%20%E2%80%94%20report">support@pacr.life</a></P>
        <P>We aim to respond within 7 days.</P>
      </>,
    },
  ],
  foot: <>Pacr · Bengaluru, India · <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a></>,
};
