// © 2026 Chromatic Productions Ltd. All rights reserved.

const link = 'its.5pm.somewhere.app@gmail.com'

export function PrivacyPolicyText() {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-sunset-100/90">
      <h2 className="text-base font-semibold text-sunset-50">5PM Somewhere Privacy Policy</h2>
      <p className="text-xs text-sunset-100/60">Effective Date: 12 June 2026</p>
      <p>
        <strong className="text-sunset-100">Operator:</strong> Chromatic Productions Limited, New Zealand.
      </p>
      <p>
        This policy explains how we collect, use, store, and share information for 5PM Somewhere, a public
        global video ritual where users upload short “5PM Moment” videos.
      </p>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Information we collect</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account information, such as email address and Google sign-in details.</li>
          <li>5PM Moments you upload, including video, caption, upload time, timezone, city, and country.</li>
          <li>Profile and usage information, such as streaks, Premium status, reactions, reports, and preferences.</li>
          <li>Device and technical information, such as browser, device type, IP address, timezone, and app diagnostics.</li>
          <li>Payment-related identifiers from Stripe if you subscribe to Premium. We do not store full card details.</li>
          <li>Notification subscription details if you enable reminders.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">How we use information</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>To operate the app, live stream, profiles, reminders, streaks, Premium features, and montages.</li>
          <li>To host, process, moderate, and display uploaded 5PM Moments.</li>
          <li>To create app/social/promotional previews or compilations from public 5PM Moments under our Terms.</li>
          <li>To understand whether the app is working, fix bugs, improve quality, and prevent abuse.</li>
          <li>To send important account, authentication, payment, safety, and service notices.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Public content</h4>
        <p>
          5PM Moments are intended to be public or semi-public within the 5PM Somewhere experience. Do not upload
          anything private, sensitive, confidential, or featuring someone who has not agreed to being recorded and
          shown. We may store local/admin copies of uploaded moments for moderation, backup, product operations,
          editing, and official 5PM Somewhere promotional use.
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Service providers and storage</h4>
        <p className="mb-2">
          We use trusted service providers to run the app, including Supabase, Vercel, Stripe, Resend, Sentry,
          PostHog/Plausible, and related infrastructure providers. Your information may be processed or stored
          outside New Zealand, including in the United States, Singapore, Australia, or other regions used by those
          providers.
        </p>
        <p>We use reasonable technical and organisational safeguards, but no internet service is perfectly secure.</p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Sharing</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>We do not sell your personal information.</li>
          <li>We share data with service providers only as needed to run and improve the app.</li>
          <li>Public moments may be visible to other users and may be included in official 5PM Somewhere promotion.</li>
          <li>We may disclose information if required by law, to protect rights/safety, or to investigate abuse.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Retention and deletion</h4>
        <p>
          We keep account and content information while needed to operate the service, meet legal obligations,
          resolve disputes, enforce our Terms, and support moderation/safety. You can request deletion of your
          account or content. Some logs, backups, moderation records, or already-published promotional materials may
          take time to remove or may be retained where reasonably necessary.
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Your rights</h4>
        <p className="mb-2">Subject to applicable law, including the New Zealand Privacy Act 2020, you may request to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access or correct your personal information.</li>
          <li>Delete your account or uploaded content.</li>
          <li>Withdraw notification permission or unsubscribe from reminders.</li>
          <li>Complain to the New Zealand Office of the Privacy Commissioner.</li>
        </ul>
        <p className="mt-3">
          To exercise these rights, email{' '}
          <a href={`mailto:${link}`} className="text-sunset-300 underline hover:text-sunset-200">
            {link}
          </a>
          .
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Children</h4>
        <p>
          You must be at least 13 to use 5PM Somewhere. If you are under 18, you must have permission from a parent
          or guardian. We do not knowingly collect information from children under 13.
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Changes</h4>
        <p>We may update this policy. If changes are material, we may ask you to accept the updated terms again.</p>
        <p className="text-xs text-sunset-100/60">Last updated: 12 June 2026</p>
      </section>
    </div>
  )
}

export function TermsOfServiceText() {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-sunset-100/90">
      <h2 className="text-base font-semibold text-sunset-50">5PM Somewhere Terms of Service</h2>
      <p className="text-xs text-sunset-100/60">Effective Date: 12 June 2026</p>
      <p>
        <strong className="text-sunset-100">Operator:</strong> Chromatic Productions Limited (“we”, “us”, “5PM
        Somewhere”), a New Zealand Limited Company.
      </p>
      <p>
        These Terms set the operating rules users must accept before using 5PM Somewhere.
      </p>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">1. Acceptance</h4>
        <p>
          By creating an account, signing in, subscribing, uploading a 5PM Moment, reacting, reporting, or otherwise
          using the app, you agree to these Terms and our Privacy Policy. You must stop using the app if you do not
          agree.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">2. Eligibility</h4>
        <p>
          You must be at least 13 years old. If you are under 18, you must have permission from a parent or guardian.
          You must not use the app if you are legally barred from doing so.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">3. The 5PM Moment</h4>
        <p>
          5PM Somewhere is built around short videos recorded around 5:00 PM local time. The app may limit capture
          windows, recording length, upload count, storage, visibility, reactions, reminders, and Premium features.
          We may change these features as the product evolves.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">4. Your content and our licence</h4>
        <ul className="list-disc space-y-2 pl-5">
          <li>You keep ownership of the videos, captions, and other content you upload.</li>
          <li>
            By uploading a 5PM Moment, you grant us a worldwide, non-exclusive, royalty-free, transferable and
            sublicensable licence to host, store, secure, reproduce, transcode, edit for format/length/branding,
            display, stream, distribute, make available, and promote that content in connection with 5PM Somewhere.
          </li>
          <li>
            This licence includes use in the app, on our website, in live streams, montages, product pages, launch
            material, social media posts, trailers, ads, pitch decks, press, and other official 5PM Somewhere
            promotional materials.
          </li>
          <li>
            You will not be paid for ordinary service, marketing, social, or promotional use of uploaded content,
            unless we separately agree in writing.
          </li>
          <li>
            The licence continues after you delete your account where content has already been used, shared,
            backed up, included in a montage/promo, or retained for legal, safety, moderation, or operational reasons.
            We will still try to honour reasonable removal requests where practical.
          </li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">5. Your responsibilities</h4>
        <p className="mb-2">You promise that:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>You own or have permission to upload everything in your 5PM Moment.</li>
          <li>Anyone clearly shown or recorded has consented, especially children or people in private settings.</li>
          <li>Your content does not include private information, confidential material, or unlicensed music/video.</li>
          <li>Your content does not violate copyright, privacy, publicity, consumer, or other laws.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">6. Prohibited content and conduct</h4>
        <p className="mb-2">You must not upload, share, or do anything that:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Is illegal, exploitative, abusive, hateful, harassing, threatening, or sexually explicit.</li>
          <li>Targets, exploits, or endangers children or vulnerable people.</li>
          <li>Shows private information, nudity, violence, dangerous acts, or someone in a private space without consent.</li>
          <li>Infringes copyright, trade marks, music rights, privacy rights, or other third-party rights.</li>
          <li>Spams, manipulates reactions/views, bypasses limits, scrapes, reverse-engineers, or attacks the app.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">7. Moderation, reports, and removal</h4>
        <p>
          We may review, hide, remove, restrict, or preserve any content or account at our discretion, including in
          response to reports. We are not required to host any content. You can report moments in the app and can
          request deletion or review by contacting us.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">8. Premium and payments</h4>
        <p>
          Premium subscriptions are processed by Stripe or another payment provider. Prices, benefits, trial terms,
          billing periods, cancellation options, and refund rules are shown at checkout or in account/billing tools.
          Refunds are provided only where required by law or at our discretion.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">9. Intellectual property</h4>
        <p>
          The app, brand, logo, design, code, copy, and related materials belong to us or our licensors. You may not
          copy, clone, scrape, resell, or misuse them without permission.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">10. Availability and changes</h4>
        <p>
          The app is provided as-is and may change, break, pause, or be discontinued. We may update features,
          eligibility, limits, pricing, content rules, or these Terms as the product evolves.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">11. Liability</h4>
        <p>
          To the maximum extent permitted by New Zealand law, we are not liable for indirect, incidental,
          consequential, special, or punitive loss, lost profits, lost data, reputational harm, or user-generated
          content. Our total liability for claims relating to the app is limited to NZ$100 or the amount you paid us
          in the previous 3 months, whichever is greater.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">12. Governing law</h4>
        <p>These Terms are governed by New Zealand law. Disputes will be resolved in New Zealand courts.</p>
      </section>

      <p>
        Contact:{' '}
        <a href={`mailto:${link}`} className="text-sunset-300 underline hover:text-sunset-200">
          {link}
        </a>
      </p>
      <p className="text-xs text-sunset-100/55">© 2026 Chromatic Productions Limited. All rights reserved.</p>
    </div>
  )
}
