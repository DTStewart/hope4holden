const TermsPage = () => {
  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-16 md:py-20 animate-fade-in relative z-10">
          <p className="section-label">Legal</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-white leading-[0.95]">
            Terms of Service
          </h1>
          <p className="text-white/60 mt-3 text-sm">Last updated: April 21, 2026</p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-20 max-w-3xl">
          <div className="space-y-6 text-foreground/75 leading-relaxed text-left animate-fade-in">
            <p>
              Welcome to Hope 4 Holden. By using this website or participating in the Hope 4 Holden charity golf
              tournament, you agree to these terms. We've tried to keep them in plain English.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">About us</h2>
            <p>
              Hope 4 Holden is a charity golf tournament organized by the Stewart family in Brandon, Manitoba.
              Net proceeds go to the Ataxia Telangiectasia Children's Project (ATCP) to fund research for a cure
              for A-T. Official Canadian tax receipts for donations are issued by ATCP.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Registrations, tickets, and sponsorships</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All prices are in Canadian dollars (CAD) and are charged at checkout.</li>
              <li>Team registration includes the inclusions described on the registration page and is capped at the number of spots available.</li>
              <li>Sponsor tier benefits are as described on the sponsorship page at the time of purchase.</li>
              <li>Dinner tickets are per person and must be purchased in advance.</li>
            </ul>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Donations</h2>
            <p>
              Donations are processed by Stripe and forwarded to ATCP, which will issue your official Canadian tax
              receipt for eligible donations. To issue a receipt, ATCP requires your full name and mailing address,
              which is why we collect that information at checkout.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Refund policy</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Donations</strong> — donations are final and non-refundable once processed.</li>
              <li>
                <strong>Team registrations and dinner tickets</strong> — refundable up to 30 days before the
                tournament date (June 18, 2026). Inside 30 days, we can transfer your spot to another team or
                guest if you let us know, but we can't offer a cash refund.
              </li>
              <li>
                <strong>Sponsorships</strong> — non-refundable once processed, as sponsor benefits (logo placement,
                signage printing, etc.) are ordered in advance.
              </li>
              <li>
                If the tournament is cancelled outright for reasons other than weather, we'll contact you about a
                refund or credit option.
              </li>
            </ul>
            <p>
              To request a refund or transfer, email <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Weather and event changes</h2>
            <p>
              The tournament proceeds rain or shine. In the event of severe weather or safety concerns, we may
              delay, shorten, or modify the format. We'll notify registered participants by email. Refunds are
              not offered for weather-related changes.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Sponsor logos and materials</h2>
            <p>
              By uploading brand assets through the sponsor upload link, you grant Hope 4 Holden a non-exclusive,
              royalty-free license to display your business name, logos, and social handles on the tournament
              website, printed materials, and event signage for the purpose of recognizing your sponsorship.
              This license ends after the 2026 tournament and related post-event communications.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Participant conduct</h2>
            <p>
              We expect all participants and sponsors to act respectfully toward staff, volunteers, and other
              attendees, and to follow the host venue's rules. We reserve the right to remove anyone whose
              behaviour makes the event unsafe or unpleasant for others, without a refund.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Website content</h2>
            <p>
              Content on this website (photos, logos, copy) is owned by Hope 4 Holden or used with permission.
              You may share links to our pages; please don't republish our photos or copy without asking.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Limitation of liability</h2>
            <p>
              Participation in golf and tournament events involves inherent risks. To the fullest extent permitted
              by law, Hope 4 Holden, the Stewart family, and our volunteers are not liable for personal injury,
              property loss, or indirect damages arising from your participation in the event or your use of this
              website. A separate liability waiver will be signed at the event itself.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Changes to these terms</h2>
            <p>
              We may update these terms as the tournament evolves. If we make material changes, we'll update the
              "Last updated" date above and, where appropriate, notify registered participants.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Governing law</h2>
            <p>
              These terms are governed by the laws of the Province of Manitoba and the laws of Canada applicable
              there, without regard to conflict-of-laws rules.
            </p>

            <h2 className="font-heading font-extrabold text-2xl text-foreground pt-4">Contact</h2>
            <p>
              Questions? Email <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsPage;
