// /privacy: the privacy policy, rewritten on 11 November 2026 from an
// inventory of what the app, the website and their servers actually do (the
// old policy described anonymous accounts, on-device-only GPS and a daily AI
// coach, none of which is true any more). Every statement here should be
// traceable to the code; change the words when the product changes. Not
// legal advice: have it reviewed before it's published.
import { H3, OL, P, Table, UL, type LegalDoc, type LegalSection } from "./Legal";

const mail = <a href="mailto:support@pacr.life">support@pacr.life</a>;

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "who", nav: "Who we are",
    num: "01 / Who we are",
    title: "Who we are.",
    body: <>
      <P>Pacr is a running app for finding squads, group runs, run buddies and events, and for tracking and training your own runs. It is made by Pacr Life (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), based in Bengaluru, India. This policy covers the Pacr app on iOS and Android and the website at <a href="https://pacr.life">pacr.life</a> — together, &quot;Pacr&quot;.</P>
      <P>It explains what personal data we collect, why, who can see it, who we share it with, how long we keep it and what you can do about it. For anything here, write to {mail}.</P>
    </>,
  },
  {
    id: "summary", nav: "The short version",
    num: "02 / The short version",
    title: "The short version.",
    body: <>
      <UL>
        <li><strong>You need an account</strong> to use the app. You sign in with Apple, Google or your email and a one-time code.</li>
        <li><strong>Your runs are stored on our servers</strong>, including the full GPS route, so they survive a new phone. Only you can see the full route.</li>
        <li><strong>Other people see what you choose to share</strong>: your posts by the audience you pick, your squads&apos; leaderboards, your public profile if you set a handle, your saved routes unless you make them private.</li>
        <li><strong>Health data</strong> from Apple Health, Health Connect, Garmin or WHOOP is used only to show your runs and training. We don&apos;t sell it or use it for ads.</li>
        <li><strong>We never sell your data and there are no ads.</strong></li>
        <li><strong>You can delete your account</strong> in the app, under Profile → Settings → Delete account. Some records stay where the law or other people need them (Section 12).</li>
      </UL>
    </>,
  },
  {
    id: "collect", nav: "What we collect",
    num: "03 / What we collect",
    title: "What data we collect.",
    body: <>
      <H3>3a. Your account and profile</H3>
      <Table head={[<>Data</>, <>Why</>, <>Required?</>]} rows={[
        [<>Email address, or the account Apple or Google gives us when you sign in with them (Apple may give us your name)</>, <>Signing you in and identifying your account</>, <>Yes, one of them</>],
        [<>Display name</>, <>Shown on your posts, squads, leaderboards and runs</>, <>Yes</>],
        [<>Age, height and weight</>, <>Calorie and effort estimates, and your training plan</>, <>Yes (height starts at a default you can change)</>],
        [<>Gender (or &quot;prefer not to say&quot;)</>, <>Effort estimates, your training plan, and women-only squads and runs</>, <>Yes, an answer</>],
        [<>Profile photo or a chosen avatar, handle, bio, tags, location (a place name you type), Instagram handle</>, <>Your profile and your public card</>, <>Optional</>],
      ]} />
      <H3>3b. Your training profile (only if you use the plan builder)</H3>
      <P>Your goal and experience, your goal race (name, place, date), recent running, fitness markers you know (such as threshold pace, VO2max, maximum and resting heart rate), days and time you have, cross-training, sleep, stress and HRV, injuries or illness (including a note you write), work and travel patterns, and coaching preferences. We use it to write your plan (Section 8).</P>
      <H3>3c. Your runs</H3>
      <Table head={[<>Data</>, <>Why</>]} rows={[
        [<>Each run: start time, distance, duration, pace, elevation, title, your notes, effort and how it felt</>, <>Your history, records, badges and squad leaderboards</>],
        [<>The full GPS route of each run (positions, altitude and times)</>, <>Drawing your run, and restoring your history on a new phone</>],
        [<>A simplified outline of the route (up to 64 points, no map position)</>, <>Showing the shape of your run to people who can see it. You can turn this off in the app</>],
        [<>Heart rate, steps and cadence during a run, from your phone or a connected device</>, <>Your run&apos;s stats and charts</>],
        [<>Routes you save (the line and its start point)</>, <>Running them again; public routes help others find places to run</>],
        [<>Your shoes (pairs, distance, an optional photo)</>, <>Shoe mileage</>],
      ]} />
      <H3>3d. Social and community</H3>
      <P>Posts (text, photos and run cards) and who they&apos;re shared with, comments, kudos, mentions, follows, blocks and mutes, reports you make, squads you join and your role in them, answers to a squad&apos;s join questions, squad chat messages and announcements, run RSVPs and QR check-ins, and run buddies runs you post, request or join.</P>
      <H3>3e. Safety features</H3>
      <P>If you use run buddies: the area you run from (rounded to about 1 km, and only while you choose to be shown), safety check-ins after a run with company, reports and no-show marks. If you save a trusted contact, we store their name and phone number with your settings; messages to them are sent by SMS from your own phone.</P>
      <H3>3f. Events and payments</H3>
      <P>Tickets you book, the name on them, what you paid, and check-ins at the gate. Payments are handled by Razorpay (Section 11); we never see or store your card details. If you host paid events, we also hold your payout details (Section 11).</P>
      <H3>3g. App settings and technical data</H3>
      <P>Your app settings sync to your account so they follow you to a new phone (for example voice and auto-pause settings, your default post audience, rest days, reminders, badges you&apos;ve seen and daily step totals if you import them). We also collect your push notification token and time zone, the app and OS version and device model, crash reports, and how you use the app&apos;s screens (Section 9).</P>
    </>,
  },
  {
    id: "location", nav: "Location",
    num: "04 / Location",
    title: "Location.",
    body: <>
      <H3>When Pacr uses your location</H3>
      <UL>
        <li><strong>While you&apos;re using the app</strong>: to show weather and air quality, and to find squads, runs, routes, events and run buddies near you.</li>
        <li><strong>In the background, only during a run you&apos;re recording</strong>, so the route keeps recording with the screen locked. It stops when the run ends.</li>
      </UL>
      <H3>Where it goes</H3>
      <UL>
        <li><strong>Your recorded runs</strong>: the full route is backed up to your account. Only you can see it.</li>
        <li><strong>Nearby searches</strong>: your position is sent to our servers to find what&apos;s near you. It isn&apos;t stored for this.</li>
        <li><strong>Weather and air quality</strong>: your position (to about 10 m) is sent to Open-Meteo, with no name or account attached.</li>
        <li><strong>Place search</strong>: when you search for a meeting place, what you type and your approximate position go to Google Places.</li>
        <li><strong>Maps</strong>: when a run or place is drawn on a map, its position goes to the map provider (Google Maps, Mapbox or OpenStreetMap).</li>
        <li><strong>Public routes</strong>: a route you save is public unless you make it private. Others can see its line and starting point (your name only if you choose to show it). A route that starts at your home shows your home: keep it private.</li>
      </UL>
      <H3>Live run sharing</H3>
      <P>You can share a run as it happens with a link. It is off until you turn it on for a run. While it&apos;s on, anyone with the link can see your name, where you are, the route so far, your distance and time. The link isn&apos;t listed anywhere or indexed by search engines, but anyone you send it to can pass it on. Stopping the share kills the link and deletes the stored route behind it. Live sharing is not an emergency service.</P>
      <P>You can turn location off in your phone&apos;s settings. Run recording, nearby search and weather won&apos;t work without it.</P>
    </>,
  },
  {
    id: "health", nav: "Health and devices",
    num: "05 / Health and devices",
    title: "Health data and connected devices.",
    body: <>
      <P>Only if you connect them:</P>
      <UL>
        <li><strong>Apple Health</strong>: Pacr reads workouts and their routes, heart rate, walking and running distance, active energy and steps, and writes your Pacr runs (workout, route, distance, active energy).</li>
        <li><strong>Health Connect</strong> (Android): Pacr reads exercise sessions, heart rate, distance, active calories, elevation and steps, and writes your Pacr runs (session, route, distance, calories).</li>
        <li><strong>Garmin</strong>: activities with their GPS trace, heart rate and steps, the device name, and daily resting heart rate, sleep and HRV. Pacr can send your plan workouts and saved routes to your Garmin.</li>
        <li><strong>WHOOP</strong>: workouts, daily cycles, recovery (including resting heart rate, HRV, blood oxygen and skin temperature), sleep, and your first name, height and weight.</li>
        <li><strong>Apple Watch</strong>: Pacr sends your plan&apos;s sessions to the Watch&apos;s Workout app.</li>
      </UL>
      <P>Runs you import are stored like runs you record (Section 3c) and count towards your squads&apos; leaderboards. We use health data only to show your runs and training and to build your plan. We don&apos;t sell it, use it for ads, or share it with anyone except the service providers that run Pacr. You can disconnect any of these in the app or in the other company&apos;s app; Garmin and WHOOP access is also revoked when you delete your account.</P>
    </>,
  },
  {
    id: "visibility", nav: "Who can see what",
    num: "06 / Who can see what",
    title: "Who can see what.",
    body: <>
      <Table head={[<>What</>, <>Who can see it</>]} rows={[
        [<>Your full GPS routes, settings, training profile, gender, trusted contact</>, <>Only you (and, for gender, women-only checks made by our systems)</>],
        [<>Your name and photo</>, <>People who can see something of yours: your squads, people you follow or who follow you, and anyone who sees a post or card you made public</>],
        [<>Your runs&apos; stats and outline</>, <>You, your squads&apos; members, and followers for runs you post to followers</>],
        [<>Posts</>, <>Who you choose: only you, your squads, your followers, or everyone (public posts have a web page anyone can open)</>],
        [<>Your public card at pacr.life/u/&lt;handle&gt;</>, <>Anyone, once you set a handle: name, photo, bio, tags, location and follower count</>],
        [<>Squad activity (weekly distance on leaderboards, chat, RSVPs, check-ins, join answers)</>, <>That squad&apos;s members; join answers only its organisers</>],
        [<>Run buddies</>, <>People on the same run see your full name; everyone else sees &quot;First L.&quot;. Runs that share their place on approval show others a point near it, not the place</>],
        [<>Live run link</>, <>Anyone with the link, until you stop it</>],
        [<>Event tickets</>, <>The event&apos;s hosts see attendees&apos; names, ticket types and what they paid</>],
      ]} />
      <H3>Our staff</H3>
      <P>A small number of Pacr staff can see account details (including your email, sign-in method, gender and activity totals) to support you, verify squads and hosts, handle reports and keep run buddies safe. Our staff tools don&apos;t show your full GPS routes or your synced settings. Every view of a host&apos;s payout details is logged.</P>
    </>,
  },
  {
    id: "use", nav: "How we use your data",
    num: "07 / How we use your data",
    title: "How we use your data.",
    body: <>
      <OL>
        <li><strong>To run Pacr</strong>: record and show your runs, build your plan, run squads, feeds, run buddies and events, and sync your account across devices.</li>
        <li><strong>To keep people safe</strong>: reports, blocks, a filter for abusive words, suspensions and run buddies safety checks.</li>
        <li><strong>To send notifications you&apos;ve allowed</strong>: kudos, comments, squad runs, tickets and so on. You choose which in the app.</li>
        <li><strong>To fix and improve Pacr</strong>: crash reports and app-usage analytics (Section 9).</li>
        <li><strong>To meet legal duties</strong>: tax and payment records, and lawful requests.</li>
      </OL>
      <P>We process your data on the basis of your consent, which you give by creating an account and using these features and can withdraw at any time (Section 14), and where the law allows it without consent, such as keeping payment records. We don&apos;t send marketing emails, we don&apos;t build advertising profiles, and we don&apos;t use ad networks.</P>
    </>,
  },
  {
    id: "ai", nav: "The AI plan builder",
    num: "08 / The AI plan builder",
    title: "The AI plan builder.",
    body: <>
      <P>When you build a training plan, your training profile (Section 3b), your age and gender, and totals from your last six weeks of running are sent as text to Google&apos;s Gemini to write the plan. Your name, email and GPS routes are not sent. The plan is then checked against our own training rules and stored with your account.</P>
    </>,
  },
  {
    id: "providers", nav: "Service providers",
    num: "09 / Service providers",
    title: "Service providers we use.",
    body: <>
      <P>These companies process data for us to run Pacr. They may only use it to provide their service to us.</P>
      <Table head={[<>Provider</>, <>What they get</>, <>Why</>]} rows={[
        [<>Supabase</>, <>Everything stored in your account (Sections 3–5)</>, <>Database, sign-in and file storage</>],
        [<>Vercel</>, <>Web requests to pacr.life</>, <>Hosting the website</>],
        [<>Resend</>, <>Your email address</>, <>Sending sign-in codes</>],
        [<>Apple and Google</>, <>Sign-in requests; push notifications</>, <>Sign in with Apple and Google; delivering notifications</>],
        [<>Expo</>, <>Your push token; app update checks</>, <>Delivering notifications and app updates</>],
        [<>Google Gemini</>, <>Your training profile, age, gender and recent running totals</>, <>Writing your training plan (Section 8)</>],
        [<>PostHog</>, <>Your account ID, the screens you use, your age, gender, goal, experience and weekly days, and the distance, time and calories of runs you finish</>, <>Understanding which features help runners</>],
        [<>Sentry</>, <>Crash reports with your account ID, app version and device</>, <>Finding and fixing crashes</>],
        [<>Razorpay</>, <>Your name, email and the amount</>, <>Taking payment for tickets (Section 11)</>],
        [<>Google Maps and Places, Mapbox, OpenStreetMap</>, <>Positions of runs and places being drawn; place searches</>, <>Maps, route images, the run flyover and place search</>],
        [<>Open-Meteo</>, <>Your position, with nothing that identifies you</>, <>Weather and air quality</>],
        [<>Garmin, WHOOP</>, <>Only if you connect them (Section 5)</>, <>Importing your activities and health data</>],
        [<>Meta (Instagram)</>, <>The image you choose to share</>, <>Sharing a run card to your Instagram story</>],
      ]} />
      <P>We don&apos;t sell, rent or trade your personal data.</P>
    </>,
  },
  {
    id: "website", nav: "The website",
    num: "10 / The website",
    title: "The website, cookies and browser storage.",
    body: <>
      <P>pacr.life uses no advertising trackers. It stores one cookie to remember the city you picked, and, if you sign in, keeps your sign-in in your browser&apos;s storage. Maps on the site load from Google Maps, and live run pages load map tiles from OpenStreetMap, so those companies see your IP address when the map loads.</P>
    </>,
  },
  {
    id: "payments", nav: "Payments",
    num: "11 / Payments",
    title: "Payments and payouts.",
    body: <>
      <P>When you buy a ticket, Razorpay takes the payment. We send Razorpay your name, email and the amount, and keep Razorpay&apos;s order and payment references, the payment method, the fees and tax, the name on the order and the email Razorpay returns. We never see or store card numbers, UPI PINs or bank passwords.</P>
      <P>If you host paid events, we hold the payout details you give us: account holder name, UPI ID or bank account number and IFSC, and optionally your PAN. You see them masked; a few Pacr staff can see them in full to pay you, and every view is logged.</P>
    </>,
  },
  {
    id: "retention", nav: "Keeping and deleting",
    num: "12 / Keeping and deleting",
    title: "How long we keep data, and deleting it.",
    body: <>
      <P>We keep your data while you have an account. You can also delete things one at a time: deleting a run deletes its stats, its route backup and its post; you can delete posts and comments; stopping a live share deletes its route. Run buddies chats are deleted 7 days after the run closes.</P>
      <H3>Deleting your account</H3>
      <P>In the app, open <strong>Profile → Settings → Delete account</strong>, or write to {mail} from the email on your account. Deleting in the app happens straight away. It deletes your account and the data linked to it: your profile, runs and route backups, posts, comments, follows, settings, photos and pictures you uploaded, and your connections to Apple, Garmin and WHOOP. A squad you own alone passes to the next member, or is deleted if nobody is left. You can&apos;t delete your account while you&apos;re hosting an event with tickets sold or money still to settle.</P>
      <H3>What stays after you delete your account</H3>
      <UL>
        <li><strong>Payment records</strong> (orders, the name on them, payment references and disputes), because tax and payment law require them.</li>
        <li><strong>Messages in squad chats and run buddies chats</strong>, without your name, so the conversation still makes sense to others.</li>
        <li><strong>Reports made about your account</strong> and our staff&apos;s actions on them, to keep the community safe.</li>
        <li><strong>Analytics and crash data</strong> held by PostHog and Sentry, which are linked to a random ID, not your name. Write to {mail} and we&apos;ll have them deleted too.</li>
      </UL>
      <P>Uninstalling the app doesn&apos;t delete your account.</P>
    </>,
  },
  {
    id: "storage", nav: "Where data is stored",
    num: "13 / Where data is stored",
    title: "Where your data is stored.",
    body: <>
      <P>Your account data is stored with Supabase. Some of our service providers (Section 9) process data outside India, including in the United States and the European Union. We only use providers that commit to protecting it.</P>
    </>,
  },
  {
    id: "rights", nav: "Your rights",
    num: "14 / Your rights",
    title: "Your rights.",
    body: <>
      <P>Under India&apos;s Digital Personal Data Protection Act, 2023, and similar laws where you live, you can:</P>
      <UL>
        <li><strong>See</strong> what personal data we hold about you and who we&apos;ve shared it with</li>
        <li><strong>Correct or update</strong> it: most of it you can edit in the app</li>
        <li><strong>Delete</strong> it (Section 12)</li>
        <li><strong>Withdraw consent</strong> for a feature at any time, for example by disconnecting a device, turning off route outlines or live sharing, or deleting your account</li>
        <li><strong>Nominate</strong> someone to act for you if you die or can&apos;t act yourself</li>
        <li><strong>Complain</strong> to our Grievance Officer (Section 19), and if you&apos;re not satisfied, to the Data Protection Board of India</li>
      </UL>
      <P>Write to {mail}. We&apos;ll answer within 30 days.</P>
    </>,
  },
  {
    id: "children", nav: "Children",
    num: "15 / Children",
    title: "Children.",
    body: <>
      <P>You must be at least 13 to use Pacr. If you are under 18, a parent or guardian must agree to our terms and this policy for you, and must make any payment. If you think a child under 13 is using Pacr, write to {mail} and we&apos;ll delete their account.</P>
    </>,
  },
  {
    id: "security", nav: "Security",
    num: "16 / Security",
    title: "Security.",
    body: <>
      <UL>
        <li>All traffic between your phone or browser and Pacr is encrypted.</li>
        <li>Database rules decide what each account can read, so you only get what you&apos;re allowed to see.</li>
        <li>Keys for Garmin and WHOOP are readable only by our servers.</li>
        <li>Staff access is limited to the people who need it, and access to payout details is logged.</li>
      </UL>
      <P>No system is perfectly secure. If a breach affects your data, we&apos;ll tell you and the authorities as the law requires.</P>
    </>,
  },
  {
    id: "law", nav: "Law enforcement",
    num: "17 / Law enforcement",
    title: "Legal requests.",
    body: <>
      <P>We share data with authorities only when Indian law requires it, and we share only what the request needs.</P>
    </>,
  },
  {
    id: "changes", nav: "Changes",
    num: "18 / Changes",
    title: "Changes to this policy.",
    body: <>
      <P>When Pacr changes how it uses your data, we&apos;ll update this policy and the date at the top. For big changes, we&apos;ll also tell you in the app before they take effect.</P>
    </>,
  },
  {
    id: "contact", nav: "Contact",
    num: "19 / Contact and grievances",
    title: "Contact and grievances.",
    body: <>
      <P>Questions, requests or complaints about your data:</P>
      <P><strong>Vishnu, Grievance Officer, Pacr Life</strong><br /><strong>Email:</strong> {mail}<br />Bengaluru, Karnataka, India</P>
      <P>We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</P>
    </>,
  },
];

export const PRIVACY: LegalDoc = {
  overline: "Legal",
  title: "Privacy policy.",
  dates: ["Effective · 11 November 2026", "Last updated · 11 November 2026"],
  sections: PRIVACY_SECTIONS,
};
