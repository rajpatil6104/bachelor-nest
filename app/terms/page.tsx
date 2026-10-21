import type { Metadata } from 'next';
import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'The rules for using BachelorsNest — a discovery platform connecting bachelors with owners. No brokerage, no rent handling, ever.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="By using BachelorsNest you agree to these terms. They are written to be readable — if anything is unclear, ask us at contact.bachelorsnest@gmail.com before using the platform."
    >
      <LegalSection heading="What BachelorsNest is — and is not">
        <p>
          BachelorsNest is a discovery and connection platform: owners list PGs, hostels,
          rooms and flats, and bachelors find them and connect directly. We are <b>not</b> a
          broker, agent, landlord or property manager. We are not a party to any rental
          agreement you make — that agreement is only between the tenant and the owner.
        </p>
        <p>
          We never charge brokerage, and we never collect rent, deposits or fees between
          tenant and owner. All payments happen directly between you and the other party,
          outside BachelorsNest.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts">
        <p>
          Give accurate information when you sign up and keep your login details to yourself.
          Owners must complete identity verification (KYC) before they can log in and list —
          we check the government ID you upload. We may suspend or remove accounts or listings
          that break these terms or our policies, for example fake listings, wrong prices or
          photos, a stay that is advertised as bachelor-friendly but is not, spam, or abusive
          behaviour.
        </p>
      </LegalSection>

      <LegalSection heading="Listings">
        <p>
          Owners are responsible for their listings being accurate and current — the price,
          photos, location, rules and the number of beds actually available. Every listing is
          reviewed by our team before it goes live, and owners&apos; edits are re-reviewed.
          Review is a basic sanity check, not a guarantee: we do not own, inspect or manage
          the properties.
        </p>
      </LegalSection>

      <LegalSection heading="Visits, reviews and messages">
        <p>
          Visit requests are an introduction, not a booking or a promise of a room. Reviews
          can only be written after a completed visit and must describe your own genuine
          experience. Messages must stay respectful and on-topic; harassment, spam and
          solicitation can lead to removal.
        </p>
      </LegalSection>

      <LegalSection heading="What “verified” means">
        <p>
          A “verified owner” means we checked the government ID they submitted against their
          account. It does not guarantee the property, the owner, or your experience. Always
          visit a stay in person and satisfy yourself before paying anyone anything — and
          never pay through anyone claiming to represent BachelorsNest.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Do not create fake accounts or listings, scrape the platform abusively, attempt to
          bypass security or rate limits, upload content you do not have the right to use, or
          use BachelorsNest for anything illegal.
        </p>
      </LegalSection>

      <LegalSection heading="Liability">
        <p>
          The platform is provided “as is”. To the extent the law allows, BachelorsNest is not
          responsible for disputes between tenants and owners, the condition of any property,
          or losses arising from arrangements made between users. Nothing in these terms
          removes rights you have under Indian consumer law.
        </p>
      </LegalSection>

      <LegalSection heading="Law and changes">
        <p>
          These terms are governed by the laws of India. We may update them; the current
          version always lives on this page with its date, and continuing to use the platform
          after a change means you accept it.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
