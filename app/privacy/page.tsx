import type { Metadata } from 'next';
import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What data BachelorsNest collects, why we collect it, who we share it with, and how you can get it deleted.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="BachelorsNest is a platform that helps bachelors in India find PGs, hostels, rooms and flats listed directly by their owners. This policy explains, in plain language, what information we collect when you use it, why, who can see it, and the choices you have. Questions about anything here: contact.bachelorsnest@gmail.com."
    >
      <LegalSection heading="What we collect">
        <p>
          <b>Account details.</b> Your name, email address and phone number when you sign up.
          Owners also share their property city and locality. Your password is never visible to
          us — it is stored in hashed form by our authentication provider.
        </p>
        <p>
          <b>Owner verification documents.</b> If you register as an owner, we ask for a
          government-issued ID (and, in the listing wizard, a proof of address). These are used
          only to verify that you are a real owner, and are stored in a private area that only
          our admin reviewers can open, through short-lived signed links.
        </p>
        <p>
          <b>Listings and activity.</b> The photos, descriptions, prices and availability an
          owner publishes; and your activity on the platform — visit requests, in-app messages,
          saved stays, vacancy alerts, reviews, listing reports and flatmate posts.
        </p>
        <p>
          <b>Technical basics.</b> Your IP address is used briefly to rate-limit sensitive
          requests (like verification codes) and to keep the service secure. Like almost every
          website, our hosting also keeps standard server logs for a short period.
        </p>
        <p>
          <b>Preferences on your device.</b> Your theme choice and a few settings are kept in
          your browser&apos;s local storage. If you use a demo login, demo data is kept there
          too — it never reaches our servers.
        </p>
      </LegalSection>

      <LegalSection heading="Why we collect it">
        <p>
          To run the service: create your account, verify owners, show live vacancies, connect
          you with owners or bachelors, and let you message each other. To communicate: we email
          verification codes, visit-request updates and vacancy alerts from our own Gmail
          account. To keep the platform safe: reviewing listings and owner documents, acting on
          reports, and preventing spam and abuse.
        </p>
      </LegalSection>

      <LegalSection heading="Who can see it">
        <p>
          <b>Other users, as part of the service.</b> When you book a visit or send a message,
          the owner sees your name and what you wrote. Listings, reviews and owner names on
          listings are public. Your email and phone are not shown publicly; owners and
          bachelors connect through the in-app chat.
        </p>
        <p>
          <b>Service providers who run pieces of the platform for us:</b> Supabase (database,
          sign-in and file storage), Vercel (website hosting), Google / Gmail (sending our
          emails), and OpenStreetMap with its Nominatim service (showing maps and looking up
          listing locations — a map request necessarily shares your IP address with the map
          provider, as with any embedded map).
        </p>
        <p>
          <b>Nobody else.</b> We do not sell your personal data, and we do not share it with
          advertisers. There are no advertising trackers on BachelorsNest.
        </p>
      </LegalSection>

      <LegalSection heading="Money stays between you and the owner">
        <p>
          BachelorsNest never collects rent, deposits or any other payment, and we never ask
          for your bank, card or UPI details. Any payment happens directly between the tenant
          and the owner, outside this platform. If anyone claiming to be BachelorsNest asks you
          for payment details, treat it as a scam and tell us.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it, and deletion">
        <p>
          We keep your information while your account is active. You can ask us at any time to
          delete your account and personal data by writing to contact.bachelorsnest@gmail.com —
          your listings, photos and profile are removed with the account. A few records may be
          kept longer where the law or platform safety requires it (for example, reports about
          fraud), and routine backups age out on their normal cycle.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          You can ask us to show you the personal data we hold about you, correct anything
          wrong, or delete it — write to contact.bachelorsnest@gmail.com and we will respond
          within a reasonable time. You can also withdraw consent for optional emails by simply
          deleting the alert or telling us; service emails about your own visits continue
          while you use those features.
        </p>
      </LegalSection>

      <LegalSection heading="Security & age">
        <p>
          The site is served over HTTPS, passwords are hashed, and database access rules limit
          every account — tenant, owner and admin — to only the data it is allowed to see.
          BachelorsNest is meant for adults (18+), since renting a stay involves a contract
          between tenant and owner.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If this policy changes in a meaningful way, we will update this page and the date at
          the top. Continuing to use BachelorsNest after a change means you accept the updated
          policy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
