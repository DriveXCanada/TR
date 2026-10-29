import Link from 'next/link';
import { ConceptBanner, PoweredByDriveX, Wordmark } from '@/components/Brand';
import { PrintButton } from '@/components/PrintButton';

export const metadata = {
  title: 'Privacy notice — Field Operations',
  robots: { index: false, follow: false },
};

/**
 * Public, unauthenticated — a volunteer taps through to this from the consent
 * step before they have an account, and may well want to read it before
 * agreeing to anything.
 *
 * Everything stated here is a fact about what this build actually does. If the
 * app changes, this changes with it; a notice that drifts from the system is
 * worse than none, because it is believed.
 */
export default function PrivacyPage(): React.ReactNode {
  return (
    <main className="min-h-screen">
      <ConceptBanner />
      <div className="no-print bg-tr-black px-4 py-4">
        <div className="mx-auto max-w-3xl"><Wordmark subtitle="Privacy notice" /></div>
      </div>

      <article className="mx-auto max-w-3xl space-y-7 px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-tr-line pb-4">
          <div>
            <h1 className="text-2xl font-black uppercase text-tr-white">Privacy notice</h1>
            <p className="mt-1 text-sm text-tr-grey">
              For volunteers signing in to a Team Rubicon Canada field kitchen deployment.
            </p>
          </div>
          <PrintButton label="Print" />
        </header>

        <Section title="The short version">
          <p>
            The kitchen asks for your dietary and medical details so it can feed you without hurting you.
            Those details are visible only to the leads running your operation, are never sold or shared
            with anyone outside Team Rubicon, and are permanently deleted after the operation&apos;s
            retention period. You can decline and sign in with a lead in person instead.
          </p>
        </Section>

        <Section title="What is collected">
          <p>At sign-in, from you:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your name and ICS role, and a phone number if you give one.</li>
            <li>
              <strong className="text-tr-white">Allergies, intolerances and dietary choices</strong>, each with
              how serious it is and any note you add.
            </li>
            <li>
              <strong className="text-tr-white">Whether you carry an auto-injector and where it is kept.</strong>{' '}
              This is shown to the kitchen team so somebody can find it in an emergency.
            </li>
            <li>The days and meals you are on site for.</li>
            <li>PPE sizes — shirt, gloves, boots, respirator, hard hat — so logistics can order kit that fits.</li>
            <li>Optional preferences: food you like, food you would rather avoid, anything that lifts morale.</li>
            <li>The date and time you agreed to this notice.</li>
          </ul>
          <p className="mt-3">
            No date of birth, no address, no health number, no emergency contact, no photograph. The form does
            not ask for a medical diagnosis — only what you cannot eat and how serious it is.
          </p>
        </Section>

        <Section title="Why">
          <p>
            One reason: so the food served to you is safe. A severe allergy that the kitchen does not know
            about is the failure this whole system exists to prevent. Sizes are used only to order protective
            equipment. Preferences are used only to cook things people actually want.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The leads and assistants <strong className="text-tr-white">assigned to your operation</strong>.
              Somebody working a different deployment cannot see your record, and the system returns
              &ldquo;not found&rdquo; rather than &ldquo;access denied&rdquo; so it does not even confirm
              that your operation exists.
            </li>
            <li>The organisation&apos;s administrator account.</li>
          </ul>
          <p className="mt-3">
            It is not sold, not used for marketing, and not shared with any third party. There are no
            analytics, advertising or tracking services in this application. This build sends nothing to any
            external service — there is no AI integration and no outbound data transfer.
          </p>
          <p className="mt-3">
            Printed sheets are an exception worth naming: once a brief or roster is printed, the paper leaves
            the application&apos;s access controls behind. Printed copies carry a handling warning and should
            be destroyed at demobilisation.
          </p>
        </Section>

        <Section title="How long it is kept">
          <p>
            Volunteer records are deleted a set number of days after the operation ends — 30 by default, and
            your operation&apos;s figure is shown on the sign-in page. Deletion is permanent: records are
            removed from the database, not flagged as hidden, and your restrictions are deleted along with
            them. A lead can also purge an operation&apos;s volunteer data at any time before then.
          </p>
          <p className="mt-3">
            Safety checks performed before a meal is served are kept as an operational record — these store
            the dish and whether it was cleared or held, and deliberately do not store anyone&apos;s
            restrictions.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-5">
            <li>You can decline the form and give your details to a lead in person instead.</li>
            <li>You can leave any field blank, including sizes and preferences.</li>
            <li>
              You can ask a lead to correct or delete your record at any point during the operation. Ask in
              person — the kitchen acts on what it has, so a correction only helps once it is in.
            </li>
          </ul>
        </Section>

        <Section title="Canadian handling">
          <p>
            Health information about identifiable people is personal information under Canadian privacy law,
            including PIPEDA and the applicable provincial legislation where the operation is running. It is
            collected with your consent, used only for the purpose described above, kept only as long as
            stated, and held in Canada where the hosting configuration allows.
          </p>
          <p className="mt-3">
            Questions, corrections or complaints: speak to the Food Unit Leader or Incident Commander on your
            operation.
          </p>
        </Section>

        <footer className="border-t border-tr-line pt-5 text-sm text-tr-grey">
          <p>
            This is a concept build and is not an official Team Rubicon product. Before it is used on a real
            deployment, this notice should be reviewed by whoever is accountable for privacy at Team Rubicon
            Canada — it describes what the software does, which is not the same as being legal advice.
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <Link href="/login" className="underline hover:text-tr-white">Back to sign in</Link>
            <PoweredByDriveX />
          </div>
        </footer>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactNode {
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-bold uppercase tracking-wide text-tr-red-bright">{title}</h2>
      <div className="text-sm leading-relaxed text-tr-silver">{children}</div>
    </section>
  );
}
