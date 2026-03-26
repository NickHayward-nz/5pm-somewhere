// © 2026 Chromatic Productions Ltd. All rights reserved.

const link = 'its.5pm.somewhere.app@gmail.com'

export function PrivacyPolicyText() {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-sunset-100/90">
      <h2 className="text-base font-semibold text-sunset-50">5PM Somewhere Privacy Policy</h2>
      <p className="text-xs text-sunset-100/60">Effective Date: 25 March 2026</p>
      <p>
        <strong className="text-sunset-100">Operator:</strong> Chromatic Productions Limited, New Zealand.
      </p>
      <p>We respect your privacy and comply with the Privacy Act 2020.</p>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Information We Collect</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account data (email, Google profile info)</li>
          <li>5PM Moments you upload (video file, caption, timestamp, timezone, city/country)</li>
          <li>Reactions you give (emoji counts)</li>
          <li>Technical data (device type, IP address, timezone)</li>
          <li>Optional profile information</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">How We Use Your Information</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>To operate the globe, live stream, and your personal feed</li>
          <li>To show reactions and streak progress</li>
          <li>To improve the app and send important notices</li>
          <li>To enforce our Terms of Service</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Where Your Data Is Stored</h4>
        <p>
          Videos are stored in Supabase (USA) under a secure bucket. We use reasonable security measures.
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Sharing Your Data</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Only with service providers (Supabase, Google for authentication) under strict contracts.</li>
          <li>Never sold to third parties for marketing.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Your Rights (NZ Privacy Act 2020)</h4>
        <p className="mb-2">You have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access your personal information</li>
          <li>Correct or delete it</li>
          <li>Withdraw consent (delete account)</li>
          <li>Lodge a complaint with the Office of the Privacy Commissioner</li>
        </ul>
        <p className="mt-3">
          To exercise any right, email{' '}
          <a href={`mailto:${link}`} className="text-sunset-300 underline hover:text-sunset-200">
            {link}
          </a>
          .
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Children</h4>
        <p>We do not knowingly collect data from children under 13. If we become aware, we delete it.</p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-sunset-50">Changes</h4>
        <p>We may update this policy. Continued use after changes means acceptance.</p>
        <p className="text-xs text-sunset-100/60">Last updated: 25 March 2026</p>
      </section>
    </div>
  )
}

export function TermsOfServiceText() {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-sunset-100/90">
      <h2 className="text-base font-semibold text-sunset-50">5PM Somewhere Terms of Service</h2>
      <p className="text-xs text-sunset-100/60">Effective Date: 25 March 2026</p>
      <p>
        <strong className="text-sunset-100">Operator:</strong> Chromatic Productions Limited (“we”, “us”, “5PM
        Somewhere”), a New Zealand Limited Company.
      </p>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">1. Acceptance of Terms</h4>
        <p>
          By creating an account or uploading any video (“5PM Moment”), you agree to these Terms of Service
          and our Privacy Policy.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">2. Eligibility</h4>
        <p>
          You must be at least 13 years old. If you are under 18, you must have parental/guardian consent. We
          may require verification.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">3. User Accounts</h4>
        <p>You may sign in with Google or magic link. You are responsible for keeping your account secure.</p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">4. User Content – Your 5PM Moments</h4>
        <ul className="list-disc space-y-2 pl-5">
          <li>You retain ownership of every video you upload.</li>
          <li>
            By uploading, you grant us a{' '}
            <strong className="text-sunset-100">
              worldwide, perpetual, non-exclusive, royalty-free, sublicensable licence
            </strong>{' '}
            to host, store, stream, display, reproduce, edit (for technical reasons only), and promote your
            5PM Moments in the app, on our website, and on social media.
          </li>
          <li>
            You warrant that you own all rights to the video and that it does not contain unlicensed music,
            third-party video, or material that infringes any copyright or privacy rights.
          </li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">5. Prohibited Conduct</h4>
        <p className="mb-2">You may not upload content that:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Contains copyrighted material you do not own (especially music).</li>
          <li>Is illegal, abusive, hateful, or violates any person’s privacy.</li>
          <li>Attempts to scrape, reverse-engineer, or clone the app.</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">6. Moderation & Takedown</h4>
        <p>
          We may remove any 5PM Moment at our sole discretion. You may request removal of your own content at
          any time.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">7. Intellectual Property</h4>
        <p>
          “5PM Somewhere” and our logo are trade marks (application pending). You may not use them without
          permission. The app code and design are our copyright.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">8. Premium Features & Payments</h4>
        <p>
          Premium subscriptions are billed through Apple/Google or Stripe. Cancellation is available in your
          account settings. No refunds except where required by NZ law.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">9. Limitation of Liability</h4>
        <p>
          To the maximum extent permitted by NZ law, we are not liable for any indirect, incidental, or
          consequential damages arising from your use of the app. Our total liability will never exceed
          NZ$100.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">10. Termination</h4>
        <p>
          We may suspend or terminate your account for breach of these Terms. You may delete your account at
          any time.
        </p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">11. Governing Law</h4>
        <p>These Terms are governed by the laws of New Zealand. Disputes will be resolved in New Zealand courts.</p>
      </section>

      <section>
        <h4 className="mb-1 font-semibold text-sunset-50">12. Changes to Terms</h4>
        <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>
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
