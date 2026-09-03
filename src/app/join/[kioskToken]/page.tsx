import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb, schema } from '@/lib/db';
import { daysBetween } from '@/lib/presence';
import { ConceptBanner, PoweredByDriveX, Wordmark } from '@/components/Brand';
import { JoinWizard } from './JoinWizard';

export const dynamic = 'force-dynamic';

/** Public. No login — this is the QR target a volunteer scans on their own phone. */
export default async function JoinPage(
  { params }: { params: Promise<{ kioskToken: string }> },
): Promise<React.ReactNode> {
  const { kioskToken } = await params;

  const rows = await getDb().select().from(schema.operations)
    .where(eq(schema.operations.kioskToken, kioskToken)).limit(1);
  const operation = rows[0];
  if (operation === undefined) notFound();

  return (
    <main className="min-h-screen">
      <ConceptBanner />
      <div className="bg-tr-black px-4 py-4">
        <div className="mx-auto max-w-xl"><Wordmark subtitle="Volunteer sign-in" /></div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-1 text-xl font-bold text-tr-white">{operation.name}</h1>
        <p className="mb-5 text-sm text-tr-grey">{operation.location}</p>

        <JoinWizard
          kioskToken={kioskToken}
          operationName={operation.name}
          days={daysBetween(operation.startDate, operation.endDate)}
        />

        <p className="mt-6 text-center text-xs text-tr-grey">
          Your details are visible only to the leads running this operation and are deleted after{' '}
          {operation.retentionDays} days. <a className="underline" href="/privacy">Privacy notice</a>.
        </p>
        <p className="mt-2 text-center"><PoweredByDriveX /></p>
      </div>
    </main>
  );
}
