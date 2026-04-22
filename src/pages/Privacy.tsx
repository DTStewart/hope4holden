const PrivacyPage = () => {
  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-16 md:py-20 animate-fade-in relative z-10">
          <p className="section-label">Legal</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-white leading-[0.95]">
            Privacy Policy
          </h1>
          <p className="text-white/60 mt-3 text-sm">Last updated: April 21, 2026</p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-20 max-w-3xl">
          <div className="space-y-6 text-foreground/75 leading-relaxed text-left animate-fade-in">
            <p>
              Hope 4 Holden ("we", "us", "our") is based in Brandon, Manitoba, Canada. This policy explains
              what personal information we collect through <a href="https://hope4holden.com" className="text-primary underline">hope4holden.com</a>,
              how we use it, and the choices you have. We aim to keep this in plain English.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">What we collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Contact details</strong> — name, email, phone number — when you register a team,
                buy dinner tickets, sponsor, donate, join our waitlist or newsletter, or send us a message.
              </li>
              <li>
                <strong>Mailing address</strong> — for registrations and donations, because the Canada Revenue
                Agency requires it for official charitable donation receipts issued by the Ataxia Telangiectasia
                Children's Project (ATCP).
              </li>
              <li>
                <strong>Business details</strong> — for sponsors: business name, social media handles, and
                brand assets (logos, images) you upload.
              </li>
              <li>
                <strong>Payment information</strong> — processed directly by Stripe. We never see or store
                your full card number.
              </li>
              <li>
                <strong>Limited technical data</strong> — basic request logs kept for security and
                troubleshooting (IP address, browser type, timestamps).
              </li>
            </ul>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">How we use it</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Process your registration, sponsorship, dinner tickets, or donation.</li>
              <li>Send you confirmation, event details, reminders, and receipts.</li>
              <li>Display sponsor logos and business names on the tournament website and event materials (sponsors only).</li>
              <li>Send occasional updates about Hope 4 Holden if you've opted in (unsubscribe any time).</li>
              <li>Respond to questions or requests you send us.</li>
            </ul>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Who we share it with</h2>
            <p>
              We share only what's needed to run the tournament, and only with these service providers:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Stripe</strong> — payment processing (<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">stripe.com/privacy</a>).</li>
              <li><strong>Supabase</strong> — secure database and file storage (<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">supabase.com/privacy</a>).</li>
              <li><strong>Lovable</strong> — our website hosting and transactional email delivery (<a href="https://lovable.dev/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">lovable.dev/privacy</a>).</li>
              <li>
                <strong>Ataxia Telangiectasia Children's Project (ATCP)</strong> — donor name and address are forwarded
                to ATCP so they can issue your official Canadian tax receipt.
              </li>
            </ul>
            <p>
              We don't sell your information, and we don't share it with anyone else for marketing purposes.
              We may disclose information if required by law or to protect our rights.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">How long we keep it</h2>
            <p>
              We keep tournament records for as long as we need them to run Hope 4 Holden and meet record-keeping
              obligations (typically up to 7 years for financial records, per Canadian tax law). You can ask us
              to delete or anonymize your information sooner if it isn't required for those purposes.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Your choices</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Unsubscribe</strong> — every marketing email has a one-click unsubscribe link. Transactional emails (receipts, event logistics) aren't affected.</li>
              <li><strong>Access or correct your information</strong> — email us and we'll help.</li>
              <li><strong>Delete your information</strong> — email us and we'll remove what we legally can.</li>
            </ul>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Cookies and local storage</h2>
            <p>
              We use browser storage only for essential functionality: keeping track of items in your cart during
              checkout and keeping admins logged in. We don't use tracking or advertising cookies.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Children</h2>
            <p>
              This website isn't directed at children under 13. Team registrations and ticket purchases should be
              made by an adult. If you think we have information about a child that shouldn't be there, email us
              and we'll remove it.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Governing law</h2>
            <p>
              This policy is governed by the laws of the Province of Manitoba and the laws of Canada.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Questions</h2>
            <p>
              Email <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>. We'll respond within a few business days.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPage;
