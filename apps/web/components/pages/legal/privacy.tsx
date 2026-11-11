// /privacy: privacy.html's text, word for word (headings, lists, tables,
// dates, emails). Generated from the old page's .legal-content, so edit the
// words here only when the policy itself changes.
import { H3, OL, P, Table, UL, type LegalDoc, type LegalSection } from "./Legal";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "who", nav: "Who we are",
    num: "01 / Who we are",
    title: "Who we are.",
    body: <>
      <P>Pacr (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is an AI-powered running coach app. You can reach us at:</P>
      <P><strong>Email:</strong> <a href="mailto:support@pacr.life">support@pacr.life</a><br /><strong>Website:</strong> <a href="https://pacr.life">https://pacr.life</a></P>
      <P>This policy explains what data we collect, how we use it, and the choices you have.</P>
    </>,
  },
  {
    id: "summary", nav: "Quick summary",
    num: "02 / Quick summary",
    title: "The short version.",
    body: <>
      <P>We try to collect the <strong>minimum data necessary</strong> to run the app:</P>
      <UL>
        <li><strong>Anonymous by default</strong> — you can use Pacr without an email or any identifying information. The app creates a random anonymous account on first launch.</li>
        <li><strong>Optional email</strong> — only if you want to recover your account on a new device or create a private squad.</li>
        <li><strong>Your run data is yours</strong> — we sync some of it to our servers so it works across devices, but only you and people you explicitly invite to your squad see it.</li>
        <li><strong>We never sell your data.</strong></li>
        <li><strong>No ads.</strong></li>
      </UL>
    </>,
  },
  {
    id: "collect", nav: "What data we collect",
    num: "03 / What data we collect",
    title: "What data we collect.",
    body: <>
      <H3>3a. Information you provide during onboarding</H3>
      <Table head={[<>Data</>, <>Why we collect it</>, <>Required?</>]} rows={[
        [<>Display name</>, <>Personalisation in the app and on squad leaderboards</>, <>Yes</>],
        [<>Running experience (new / regular / experienced)</>, <>Tunes the AI coach&apos;s daily workout prescriptions</>, <>Yes</>],
        [<>Goal (build habit / get faster / train for a race / general fitness)</>, <>Tunes the AI coach&apos;s daily workout prescriptions</>, <>Yes</>],
        [<>Race distance + date window (only if &quot;Train for a race&quot;)</>, <>Builds an appropriate training plan</>, <>Yes</>],
        [<>Weekly availability (2–3 / 3–4 / 5+ days)</>, <>Tunes the AI coach&apos;s daily workout prescriptions</>, <>Yes</>],
        [<>Email address</>, <>Cross-device account recovery; required to create a squad</>, <>Optional</>],
        [<>Age, gender, height, weight</>, <>Improves calorie/effort estimation</>, <>Optional, editable in Profile</>],
      ]} />
      <H3>3b. Information generated as you use the app</H3>
      <Table head={[<>Data</>, <>Why we collect it</>, <>Where it&apos;s stored</>]} rows={[
        [<>Run history (distance, duration, pace, GPS route, cadence)</>, <>Show your progress; power the leaderboard</>, <>Locally on device; <strong>summaries</strong> (distance, duration, pace, week) synced to our servers</>],
        [<>GPS route coordinates</>, <>Map your run on the Run Detail screen</>, <><strong>Only on your device</strong> — we don&apos;t send routes to our servers</>],
        [<>AI workout prescriptions</>, <>Show your daily workout suggestions</>, <>On your device and on our servers</>],
        [<>Squad memberships, invite codes, leaderboard standings</>, <>Power the social features</>, <>On our servers</>],
        [<>Rest days you mark</>, <>Adjust streak calculation</>, <>On your device and on our servers</>],
      ]} />
      <H3>3c. Technical information</H3>
      <Table head={[<>Data</>, <>Why we collect it</>]} rows={[
        [<>Account ID (a random code, not your name or email)</>, <>Link analytics and crash reports to your account, so we can see which features help runners and fix problems that affect you</>],
        [<>App version, OS version, device model</>, <>Debug crashes and improve compatibility</>],
        [<>Crash logs</>, <>Diagnose issues</>],
      ]} />
      <P>We do <strong>not</strong> collect: phone numbers, payment information, contacts, photos, microphone audio, or biometric identifiers.</P>
    </>,
  },
  {
    id: "location", nav: "Location data",
    num: "04 / Location data",
    title: "Location data.",
    body: <>
      <P>Pacr requests device location to:</P>
      <UL>
        <li>Track your GPS route during a run</li>
        <li>Show weather and air quality (AQI) at your location</li>
        <li>Suggest nearby running spots</li>
      </UL>
      <H3>When we access location</H3>
      <UL>
        <li><strong>Foreground only</strong>: while the app is open on the Home or Run screen</li>
        <li><strong>Background</strong>: only during an active run, so your route is recorded if you lock your screen. Tracking stops automatically when the run ends.</li>
      </UL>
      <H3>What we send</H3>
      <UL>
        <li><strong>GPS routes</strong>: stay on your device. The one exception is a run you choose to share live — see below — which is off by default and has to be turned on each time.</li>
        <li><strong>Coarse location</strong> (rounded to ~1 km grid): sent to a weather and air-quality data provider to fetch a forecast for your area. No personal identifier is attached.</li>
        <li><strong>Distance to running spots</strong>: computed entirely on-device.</li>
      </UL>
      <H3>Live run sharing</H3>
      <P>You can share a single run as a link — so one person can see where you are while you run. It is off by default and has to be switched on before each run; nothing is ever shared automatically.</P>
      <UL>
        <li><strong>What is stored</strong>: while a shared run is in progress we store your position and the route so far, rounded to about one metre, along with your distance, time and display name.</li>
        <li><strong>Who can see it</strong>: anyone holding the link. The link contains a random secret, is not listed anywhere, and is excluded from search engines — but it is a link, so treat it like a key and send it only to people you trust.</li>
        <li><strong>How long</strong>: the link stays available after the run as a record of it, until you turn it off.</li>
        <li><strong>Turning it off</strong>: stopping the share kills the link immediately and deletes the stored route behind it. Each run gets its own link, so turning one off never affects another.</li>
      </UL>
      <P>Live sharing is a convenience, not a safety service. It updates only while your phone has a connection, it notifies nobody, and it must not be relied on in an emergency.</P>
      <P>You can revoke location permission at any time via your device settings. Pacr remains usable without location, but run tracking, weather, and AQI features will be disabled.</P>
    </>,
  },
  {
    id: "motion", nav: "Physical activity data",
    num: "05 / Physical activity data",
    title: "Physical activity (motion sensor) data.",
    body: <>
      <P>Pacr uses your device&apos;s accelerometer to measure running cadence (steps per minute) during a run. This data is processed entirely on-device and is <strong>not transmitted externally</strong>.</P>
    </>,
  },
  {
    id: "use", nav: "How we use your data",
    num: "06 / How we use your data",
    title: "How we use your data.",
    body: <>
      <P>We use the data described above to:</P>
      <OL>
        <li><strong>Run the core app</strong>: track runs, generate workout prescriptions, calculate streaks, show progress</li>
        <li><strong>Power the squad feature</strong>: display the weekly leaderboard to people you&apos;ve invited to your squad</li>
        <li><strong>Improve the app</strong>: analytics linked to your account ID help us see which features are used and where people get stuck; we look at them in aggregate</li>
        <li><strong>Communicate with you</strong>: we don&apos;t send marketing emails. Email is used only for authentication (one-time codes for sign-in / sign-up)</li>
        <li><strong>Comply with legal obligations</strong>: respond to lawful requests if required</li>
      </OL>
      <P>We do <strong>not</strong> use your data to build advertising profiles.</P>
    </>,
  },
  {
    id: "providers", nav: "Service providers",
    num: "07 / Service providers",
    title: "Service providers we work with.",
    body: <>
      <P>To deliver the app, we share strictly necessary data with categories of trusted service providers. They are contractually bound to use your data only for the purposes we direct, and to protect it with appropriate security measures.</P>
      <Table head={[<>Provider category</>, <>What we share</>, <>Why</>]} rows={[
        [<>Hosting and database provider</>, <>Your account, display name, optional email, squad memberships, run summaries</>, <>Securely stores your account data and powers cross-device sync and the squad leaderboard</>],
        [<>AI service provider</>, <>Your run statistics, goal, experience, and weekly availability — as text in a prompt. <strong>Not</strong> your name, email, or GPS routes.</>, <>Generates your daily workout prescriptions</>],
        [<>Weather and air-quality data provider</>, <>Coarse location coordinates (~1 km grid)</>, <>Returns weather and air-quality data for your area. No personal identifier is sent.</>],
        [<>Analytics provider</>, <>Your account ID (a random code), screen-navigation events, feature interactions, app version, and the pages you visit on pacr.life. <strong>Not</strong> your name, email, GPS, or run details.</>, <>Helps us understand which features are used so we can improve the app</>],
        [<>Crash-reporting provider</>, <>Crash and freeze reports: the error, app version, OS version, device model, and your account ID. <strong>Not</strong> your name, email, GPS, or run details.</>, <>Lets us find and fix crashes</>],
        [<>Maps provider</>, <>Coordinates of a saved run (only when you view its Run Detail screen)</>, <>Renders the run&apos;s route on a map</>],
        [<>App update provider</>, <>App version and update-check requests</>, <>Delivers in-app updates</>],
      ]} />
      <P>We do <strong>not</strong> sell, rent, or trade your personal data with anyone. We do not use third-party advertising networks.</P>
    </>,
  },
  {
    id: "squad", nav: "Squad data and visibility",
    num: "08 / Squad data and visibility",
    title: "Squad data and visibility.",
    body: <>
      <P>When you create or join a squad:</P>
      <UL>
        <li>Your <strong>display name</strong> becomes visible to other members of that squad</li>
        <li>Your <strong>weekly run count, total distance, and current streak</strong> become visible to other members of that squad (this is the leaderboard)</li>
        <li>Your individual <strong>GPS routes, addresses, and personal records</strong> are <strong>not</strong> shared with squad members</li>
      </UL>
      <P>When you leave a squad, your historical leaderboard entries for that squad&apos;s past weeks remain visible to other members, but you no longer contribute new data.</P>
    </>,
  },
  {
    id: "email", nav: "Email authentication",
    num: "09 / Email authentication",
    title: "Email authentication (optional).",
    body: <>
      <P>If you choose to link an email to your account:</P>
      <UL>
        <li>We send a <strong>one-time code</strong> to that email address</li>
        <li>We use the email only to identify your account on sign-in attempts — never for marketing</li>
        <li>You can unlink the email at any time from <strong>Profile → Account</strong></li>
      </UL>
      <P>Linking an email is required to <strong>create</strong> a new squad (so your squad doesn&apos;t become orphaned if you reinstall the app). Email is <strong>not</strong> required to join a squad via invite code, to use the AI coach, or to track runs.</P>
    </>,
  },
  {
    id: "retention", nav: "Data retention",
    num: "10 / Data retention",
    title: "Data retention.",
    body: <>
      <Table head={[<>Data</>, <>Retention</>]} rows={[
        [<>On-device app data (full run history, GPS routes, prescriptions cache)</>, <>Until you delete the app or use <strong>Delete all my data</strong></>],
        [<>Account, display name, email, run summaries, squad memberships (server-side)</>, <>Until you request deletion</>],
        [<>Analytics events</>, <>12 months from event date, then auto-deleted</>],
        [<>Crash logs</>, <>90 days</>],
      ]} />
      <H3>Deleting your data</H3>
      <P>You can delete your data in two ways:</P>
      <OL>
        <li><strong>In-app</strong> — open <strong>Profile → Delete all my data</strong>. This wipes your on-device data and signs you out. Server-side records for your account are queued for deletion within 30 days.</li>
        <li><strong>By email</strong> — write to <a href="mailto:support@pacr.life">support@pacr.life</a> from the email linked to your account. We will delete all server-side records associated with you within 30 days and confirm by reply.</li>
      </OL>
      <P>Uninstalling the app deletes your on-device data but does <strong>not</strong> delete your server-side account. Use the in-app option or email us to remove that.</P>
    </>,
  },
  {
    id: "storage", nav: "Where data is stored",
    num: "11 / Where data is stored",
    title: "Where your data is stored.",
    body: <>
      <P>Pacr operates globally. Data may be stored or processed in multiple regions, including India, the European Union, and the United States. When data crosses borders, we rely on appropriate legal safeguards (such as standard contractual clauses) and on the privacy commitments of our service providers.</P>
    </>,
  },
  {
    id: "rights", nav: "Your rights",
    num: "12 / Your rights",
    title: "Your rights.",
    body: <>
      <P>Depending on where you live, you may have the right to:</P>
      <UL>
        <li><strong>Access</strong> the personal data we hold about you</li>
        <li><strong>Correct</strong> inaccurate data</li>
        <li><strong>Delete</strong> your data (see Section 10)</li>
        <li><strong>Object</strong> to or <strong>restrict</strong> certain processing</li>
        <li><strong>Port</strong> your data to another service</li>
        <li><strong>Withdraw consent</strong> for optional features (e.g., linked email)</li>
      </UL>
      <P>For most data, you can exercise these rights directly in the app. For anything else, email <a href="mailto:support@pacr.life">support@pacr.life</a> and we will respond within 30 days.</P>
      <P>If you&apos;re in India, the Digital Personal Data Protection Act 2023 applies. You may lodge a complaint with the Data Protection Board of India if we don&apos;t respond to your request.</P>
      <P>If you&apos;re in the European Union or United Kingdom, you may lodge a complaint with your local data protection authority.</P>
    </>,
  },
  {
    id: "children", nav: "Children's privacy",
    num: "13 / Children's privacy",
    title: "Children's privacy.",
    body: <>
      <P>Pacr is not directed at children under 13 (or the equivalent minimum age in your jurisdiction). We do not knowingly collect data from such children. If you believe a child has provided us with personal data, contact us at <a href="mailto:support@pacr.life">support@pacr.life</a> and we will delete it promptly.</P>
    </>,
  },
  {
    id: "security", nav: "Security",
    num: "14 / Security",
    title: "Security.",
    body: <>
      <P>We protect your data using industry-standard practices:</P>
      <UL>
        <li>All network traffic is encrypted in transit</li>
        <li>Your account data is encrypted at rest</li>
        <li>Authentication credentials are stored using your device&apos;s secure storage</li>
        <li>Strict access controls so squad members can only see data for circles they belong to</li>
      </UL>
      <P>No system is perfectly secure. If we become aware of a breach affecting your data, we will notify you and the relevant authorities as required by law.</P>
    </>,
  },
  {
    id: "changes", nav: "Changes",
    num: "15 / Changes",
    title: "Changes to this policy.",
    body: <>
      <P>We may update this policy as the app evolves. When we do, we&apos;ll:</P>
      <UL>
        <li>Update the <strong>&quot;Last updated&quot;</strong> date at the top</li>
        <li>For material changes, post a notice in the app and (if you have an email linked) send a notification to that email</li>
      </UL>
      <P>Continued use of the app after changes take effect constitutes acceptance of the updated policy.</P>
    </>,
  },
  {
    id: "contact", nav: "Contact",
    num: "16 / Contact",
    title: "Contact.",
    body: <>
      <P>Questions, concerns, or data requests:</P>
      <P><strong>Email:</strong> <a href="mailto:support@pacr.life">support@pacr.life</a><br /><strong>Website:</strong> <a href="https://pacr.life">https://pacr.life</a></P>
      <P>We aim to respond within 7 days and to fulfil verified data requests within 30 days.</P>
    </>,
  },
];

export const PRIVACY: LegalDoc = {
  overline: "Legal",
  title: "Privacy policy.",
  dates: ["Effective · 6 June 2026", "Last updated · 6 November 2026"],
  sections: PRIVACY_SECTIONS,
};
