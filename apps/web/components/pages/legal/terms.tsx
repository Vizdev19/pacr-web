// /terms: terms.html's text, word for word (headings, lists, dates, company
// name, emails). Generated from the old page's .legal-content, so edit the
// words here only when the terms themselves change.
import { H3, P, UL, type LegalDoc, type LegalSection } from "./Legal";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreement", nav: "The agreement",
    num: "01 / The agreement",
    title: "The agreement.",
    body: <>
      <P>These terms are an agreement between you and Pacr Life (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), based in Bengaluru, India. They cover the Pacr app on iOS and Android and the website at <a href="https://pacr.life">pacr.life</a> — together, &quot;Pacr&quot;.</P>
      <P>By creating an account or using Pacr, you agree to these terms, to our <a href="/privacy">privacy policy</a> and to our <a href="/community-rules">community rules</a>. If you don&apos;t agree, please don&apos;t use Pacr.</P>
    </>,
  },
  {
    id: "accounts", nav: "Your account",
    num: "02 / Your account",
    title: "Your account.",
    body: <>
      <UL>
        <li><strong>Age.</strong> You must be at least 13 (or the minimum age in your country, if higher). If you are under 18, a parent or guardian must agree to these terms for you, and must make any payment.</li>
        <li><strong>Accounts are made in the app.</strong> You sign up with Apple, Google or email. Signing in on pacr.life uses the same account.</li>
        <li><strong>One person, one account.</strong> Use your real name or a name people who run with you would recognise. Don&apos;t pretend to be someone else, and don&apos;t make accounts to get around a ban.</li>
        <li><strong>Keep it secure.</strong> You are responsible for what happens on your account. Tell us at <a href="mailto:support@pacr.life">support@pacr.life</a> if you think someone else is using it.</li>
      </UL>
    </>,
  },
  {
    id: "health", nav: "Health and safety",
    num: "03 / Health and safety",
    title: "Health and safety.",
    body: <>
      <P><strong>Pacr is not a doctor and does not give medical advice.</strong> Training plans, coaching, workout suggestions and voice cues are written partly by AI from what you tell us and from your runs. They can be wrong, and they don&apos;t know your health the way a professional does.</P>
      <UL>
        <li>Check with a doctor before you start a new training programme, especially if you have a heart condition, an injury, are pregnant, or haven&apos;t exercised in a while.</li>
        <li>Stop and get help if you feel pain, dizziness, chest tightness or shortness of breath.</li>
        <li>Distance, pace, heart rate, elevation, cadence, calories and steps come from your phone&apos;s GPS and sensors and from connected devices. They are estimates and can be off.</li>
        <li>Run where it is safe and legal to do so. Watch traffic, weather and air quality, and don&apos;t look at your phone when it isn&apos;t safe to.</li>
      </UL>
      <P>You run at your own risk, and you decide how hard to push.</P>
    </>,
  },
  {
    id: "together", nav: "Running with others",
    num: "04 / Running with others",
    title: "Running with others.",
    body: <>
      <P>Squads, clubs, run buddies and events help you run with people you may not know. We don&apos;t run background checks on anyone, and we aren&apos;t at the runs.</P>
      <UL>
        <li><strong>Use your judgement</strong> before meeting someone: meet in public places, tell someone where you&apos;re going, and leave if anything feels wrong.</li>
        <li><strong>A verified badge</strong> means we checked that a club is who it says it is. It is not a promise about any person, run or event.</li>
        <li><strong>Live run sharing</strong> is a convenience, not a safety service. It updates only while your phone has a connection, it notifies nobody, and you must not rely on it in an emergency. In an emergency, call 112 (in India) or your local emergency number.</li>
        <li><strong>Squad owners and organisers</strong> set their own join rules, questions and rules, and can remove members. Those rules sit on top of ours, never instead of them.</li>
      </UL>
      <P>If something goes wrong with another runner, report them in the app and, if it&apos;s serious, contact the police. We will help where we can — see <a href="#grievance">Grievances</a>.</P>
    </>,
  },
  {
    id: "content", nav: "Your content",
    num: "05 / Your content",
    title: "Your content.",
    body: <>
      <P>Your runs, posts, photos, comments, messages, routes and profile are yours. You keep ownership of them.</P>
      <P>To show them to the people you choose, you give us a worldwide, non-exclusive, royalty-free licence to store, copy, resize, display and share your content inside Pacr — in the app, on pacr.life and in the share links and previews Pacr makes — for as long as it&apos;s on Pacr. Who sees a post depends on the audience you pick: a squad, your followers, or everyone. <strong>Public posts, public routes and profile links can be seen by anyone, including people without an account.</strong></P>
      <P>The licence ends when you delete the content or your account, except for copies other people have already shared, backups kept for a short time, and anything we must keep by law.</P>
      <P>You are responsible for what you post. Only post things you have the right to share, including photos of other people.</P>
    </>,
  },
  {
    id: "rules", nav: "Community rules",
    num: "06 / Community rules",
    title: "Community rules.",
    body: <>
      <P>Our <a href="/community-rules">community rules</a> are part of these terms: no abuse, nothing sexual, no spam or scams, post your own runs, and respect the squad.</P>
      <P>We may remove content, hide it, limit features or suspend or close an account that breaks them. Posts that enough runners report are hidden automatically while we look. We review every report, but we can&apos;t promise to catch everything.</P>
    </>,
  },
  {
    id: "use", nav: "What you can't do",
    num: "07 / What you can't do",
    title: "What you can't do.",
    body: <>
      <P>When you use Pacr, don&apos;t:</P>
      <UL>
        <li>break the law, or help someone else to</li>
        <li>log runs you didn&apos;t do, or tamper with GPS or sensor data to climb leaderboards or earn records and badges</li>
        <li>harass, threaten, stalk or share someone&apos;s location or personal details without their consent</li>
        <li>pretend to be another person, club or organisation</li>
        <li>sell, advertise or promote anything without our permission, beyond what a host does for their own event</li>
        <li>scrape, copy or collect data from Pacr by automated means, or use it to build a competing product</li>
        <li>reverse-engineer, decompile or try to get around our security, rate limits or blocks</li>
        <li>upload malware, or do anything that harms or overloads Pacr</li>
        <li>use someone else&apos;s account, or sell or transfer yours</li>
      </UL>
    </>,
  },
  {
    id: "tickets", nav: "Event tickets",
    num: "08 / Event tickets",
    title: "Event tickets.",
    body: <>
      <P>Events on Pacr are run by their hosts — clubs and squads — not by Pacr. When you book, your agreement for the event itself is with the host. Pacr provides the listing and the booking, and collects payment on the host&apos;s behalf.</P>
      <H3>Paying</H3>
      <UL>
        <li>Payments are processed by <strong>Razorpay</strong>. We never see or store your card, UPI or bank details.</li>
        <li>The price of a paid booking is the host&apos;s ticket price, plus a <strong>Pacr fee</strong> on the tickets (currently 5%), plus <strong>GST on that fee</strong> (currently 18%). The full breakdown is shown before you pay, and that is the amount you are charged.</li>
        <li>Your spots are held for ten minutes while you pay. If the hold runs out, they go back on sale.</li>
        <li>Each seat gets its own ticket and QR code. The host may scan it at the event.</li>
      </UL>
      <H3>Cancellations and refunds</H3>
      <UL>
        <li><strong>You can&apos;t cancel a paid ticket yourself.</strong> Only the host can refund a booking, and a refund is always for the whole booking — ticket price and Pacr fee.</li>
        <li><strong>If the host cancels the event</strong>, every paid booking is refunded in full automatically.</li>
        <li>If you pay but a ticket can&apos;t be issued — for example, the event was cancelled while you paid — the payment is refunded in full.</li>
        <li>Refunds go back to how you paid. Banks usually take 5–7 working days to show them.</li>
        <li>The host&apos;s own refund policy, if they have one, is shown on the event. Ask the host first; if you can&apos;t reach them, write to <a href="mailto:support@pacr.life">support@pacr.life</a>.</li>
      </UL>
      <P>The host is responsible for the event: that it happens as described, that it is safe, and that it has whatever permits and insurance it needs. Pacr isn&apos;t responsible for an event that doesn&apos;t go as described, but tell us — we can hold a host&apos;s payout while we look into it.</P>
    </>,
  },
  {
    id: "hosting", nav: "Hosting events",
    num: "09 / Hosting events",
    title: "Hosting events.",
    body: <>
      <P>If you host events on Pacr, you also agree that:</P>
      <UL>
        <li><strong>Only verified squads host.</strong> We may refuse, hide or cancel any event that breaks these terms or the community rules.</li>
        <li><strong>You are the organiser.</strong> You are responsible for the event, the people running it, the route, permits, safety, insurance, and for describing it honestly — date, place, distance, price and what&apos;s included.</li>
        <li><strong>Payouts.</strong> To sell paid tickets you give us a UPI ID or bank account. About a day after the event ends, we pay you the ticket price of every ticket sold, minus tickets that were refunded. The Pacr fee and GST on it are ours.</li>
        <li><strong>Holds.</strong> We may delay or hold a payout while a refund is unfinished, while a complaint is open, or if we suspect fraud.</li>
        <li><strong>Refunds.</strong> You can refund a booking through Pacr until the event has been paid out. If you cancel the event, every paid booking is refunded in full, Pacr fee included.</li>
        <li><strong>Taxes.</strong> You are responsible for any tax on the money you receive for your events.</li>
        <li><strong>Attendee data.</strong> Use the names and details of people who book only to run the event, and not to market to them without their consent.</li>
      </UL>
    </>,
  },
  {
    id: "third-party", nav: "Other services",
    num: "10 / Other services",
    title: "Other services.",
    body: <>
      <P>Pacr works with services run by other companies — Apple Health, Health Connect, Garmin, WHOOP, Apple and Google sign-in, maps, Razorpay, Instagram and others. When you connect or use one, its own terms and privacy policy apply too.</P>
      <P>We don&apos;t control those services and aren&apos;t responsible for them, for data they send us, or if they change or stop working with Pacr. You can disconnect a service at any time in the app.</P>
    </>,
  },
  {
    id: "service", nav: "The service",
    num: "11 / The service",
    title: "The service.",
    body: <>
      <P>Pacr is free to use today, apart from event tickets. We are building it as we go: features will be added, changed and sometimes removed, and the app updates itself over the air. We may also introduce paid features; if we do, we&apos;ll show the price before you pay and nothing will be charged without your say-so.</P>
      <P>We work to keep Pacr running and your data safe, but we can&apos;t promise it will always be available, error-free or that a run will always record. Keep anything important somewhere else too.</P>
    </>,
  },
  {
    id: "ours", nav: "What's ours",
    num: "12 / What's ours",
    title: "What's ours.",
    body: <>
      <P>The Pacr name, logo, app, website, designs and software belong to us. We give you a personal, non-exclusive, non-transferable licence to use Pacr for your own running, under these terms. That doesn&apos;t give you any right to our brand.</P>
      <P>If you send us ideas or feedback, we may use them without owing you anything.</P>
    </>,
  },
  {
    id: "ending", nav: "Ending your account",
    num: "13 / Ending your account",
    title: "Ending your account.",
    body: <>
      <P>You can stop using Pacr at any time and delete your account in the app, under <strong>Profile → Settings</strong>, or by writing to <a href="mailto:support@pacr.life">support@pacr.life</a>. What happens to your data is set out in our <a href="/privacy">privacy policy</a>.</P>
      <P>We may suspend or close your account if you break these terms or the community rules, if we have to by law, or to protect other runners. Where it&apos;s safe and lawful, we&apos;ll tell you why and give you a chance to respond.</P>
      <P>If you are a host with events still to come or payouts outstanding, we&apos;ll settle tickets and payouts as described above before the account closes. The sections on content you&apos;ve already shared, disclaimers, liability and disputes keep applying after your account ends.</P>
    </>,
  },
  {
    id: "disclaimers", nav: "Disclaimers",
    num: "14 / Disclaimers",
    title: "Disclaimers.",
    body: <>
      <P>Pacr is provided <strong>&quot;as is&quot; and &quot;as available&quot;</strong>. To the fullest extent the law allows, we make no promises beyond those written in these terms — including about fitness for a particular purpose, accuracy of data, coaching results, or the conduct of other runners and hosts.</P>
      <P>Nothing in these terms takes away rights you have under consumer law that can&apos;t be excluded by agreement.</P>
    </>,
  },
  {
    id: "liability", nav: "Liability",
    num: "15 / Liability",
    title: "Limits on our liability.",
    body: <>
      <P>To the fullest extent the law allows:</P>
      <UL>
        <li>We aren&apos;t liable for injury, illness or loss that comes from running, training, or taking part in a run or event — including one you found through Pacr — except where it was caused by our own negligence.</li>
        <li>We aren&apos;t liable for indirect or consequential losses, lost profits or lost data.</li>
      </UL>
      <P>These limits don&apos;t apply to anything the law doesn&apos;t allow us to limit, such as liability for fraud.</P>
      <P>If you break these terms or the law and someone makes a claim against us because of it — for example, over content you posted or an event you hosted — you agree to cover our reasonable costs of dealing with that claim.</P>
    </>,
  },
  {
    id: "law", nav: "Law and disputes",
    num: "16 / Law and disputes",
    title: "Law and disputes.",
    body: <>
      <P>These terms are governed by the laws of India. If you have a problem, please write to us first — most things can be sorted out quickly. If we can&apos;t resolve it, the courts of Bengaluru, Karnataka have jurisdiction, without taking away any right you have to bring a claim in the courts where you live.</P>
      <P>If any part of these terms turns out to be unenforceable, the rest still applies. If we don&apos;t enforce a term straight away, we haven&apos;t given up the right to. You can&apos;t transfer these terms to anyone else; we may transfer them if Pacr is sold or reorganised, and we&apos;ll tell you if that happens.</P>
    </>,
  },
  {
    id: "grievance", nav: "Grievances",
    num: "17 / Grievances",
    title: "Grievances.",
    body: <>
      <P>To report content or an account, use <strong>Report</strong> on it in the app or on pacr.life. For anything else — including a complaint about how we handled a report, your data, a payment or a host — write to our Grievance Officer, in line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:</P>
      <P><strong>Vishnu, Grievance Officer, Pacr Life</strong><br /><strong>Email:</strong> <a href="mailto:support@pacr.life">support@pacr.life</a><br />Bengaluru, Karnataka, India</P>
      <P>We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</P>
    </>,
  },
  {
    id: "stores", nav: "App stores",
    num: "18 / App stores",
    title: "If you got Pacr from an app store.",
    body: <>
      <P>If you downloaded Pacr from Apple&apos;s App Store or Google Play, these terms are between you and Pacr only, not Apple or Google. They aren&apos;t responsible for Pacr, its content, support or maintenance, or for any claim about it. The store&apos;s own terms of use also apply.</P>
      <P>For the App Store: if Pacr fails to meet a warranty that applies by law, you may tell Apple and it will refund the purchase price (if any); Apple has no other warranty obligation. Apple is not responsible for product, consumer or legal claims about Pacr, or for intellectual-property claims. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you. You confirm you are not in a country under a US government embargo and not on a US government list of prohibited or restricted parties.</P>
    </>,
  },
  {
    id: "changes", nav: "Changes",
    num: "19 / Changes",
    title: "Changes to these terms.",
    body: <>
      <P>We may update these terms as Pacr changes. When we do, we&apos;ll:</P>
      <UL>
        <li>update the <strong>&quot;Last updated&quot;</strong> date at the top</li>
        <li>for material changes, tell you in the app before they take effect</li>
      </UL>
      <P>If you keep using Pacr after the changes take effect, you accept the new terms. If you don&apos;t agree, you can delete your account.</P>
    </>,
  },
  {
    id: "contact", nav: "Contact",
    num: "20 / Contact",
    title: "Contact.",
    body: <>
      <P>Questions about these terms:</P>
      <P><strong>Email:</strong> <a href="mailto:support@pacr.life">support@pacr.life</a><br /><strong>Website:</strong> <a href="https://pacr.life">https://pacr.life</a></P>
      <P>We aim to respond within 7 days.</P>
    </>,
  },
];

export const TERMS: LegalDoc = {
  overline: "Legal",
  title: "Terms of service.",
  dates: ["Effective · 10 November 2026", "Last updated · 10 November 2026"],
  sections: TERMS_SECTIONS,
};
