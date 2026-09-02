import QRCode from 'qrcode';
import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { rotateKioskToken, updateSettings } from '@/lib/actions/settings';
import { Card, money } from '@/components/ui';
import { PurgePanel } from './PurgePanel';

export const dynamic = 'force-dynamic';

function baseUrl(): string {
  const configured = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  return (configured ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export default async function SettingsPage(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers } = await loadSnapshot(id, session);

  const joinUrl = `${baseUrl()}/join/${operation.kioskToken}`;
  const qr = await QRCode.toDataURL(joinUrl, { width: 320, margin: 1 });
  const absolute = baseUrl().startsWith('http://localhost');

  return (
    <div className="space-y-6">
      <Card title="Kiosk QR" subtitle="Volunteers scan this on their own phone. No account needed.">
        {absolute && (
          <p role="alert" className="mb-3 rounded-md border border-intolerance-border bg-intolerance-bg p-2 text-sm text-intolerance">
            <code>AUTH_URL</code> is not set, so this QR points at <code>localhost</code> and will not work on
            a volunteer&apos;s phone. Set it to the public URL and redeploy.
          </p>
        )}
        {/* A data: URL QR — next/image would add work and no benefit. */}
        <img src={qr} alt={`QR code linking to ${joinUrl}`} width={320} height={320} className="rounded-md border border-black/10" />
        <p className="mt-2 break-all font-mono text-xs text-tr-grey">{joinUrl}</p>
        <form action={rotateKioskToken} className="no-print mt-3">
          <input type="hidden" name="operationId" value={id} />
          <button type="submit" className="btn-secondary">Rotate token</button>
        </form>
        <p className="mt-1 text-xs text-tr-grey">
          Rotating invalidates the printed QR immediately. Do it if a code leaves the site.
        </p>
      </Card>

      <Card title="Budget and retention">
        <form action={updateSettings} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="operationId" value={id} />
          <label className="text-sm">
            <span className="label">Per person per day ({operation.currency})</span>
            <input name="perPersonPerDay" className="input" inputMode="decimal"
              defaultValue={operation.perPersonPerDay.toFixed(2)} />
          </label>
          <label className="text-sm">
            <span className="label">Retention (days)</span>
            <input name="retentionDays" className="input" inputMode="numeric"
              defaultValue={String(operation.retentionDays)} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-tr-grey">
          The day budget is this rate times the number of people on site that day — currently{' '}
          {money(operation.perPersonPerDay, operation.currency)} per person.
        </p>
      </Card>

      <Card title="Meal schedule">
        <p className="text-sm text-tr-ink">
          {operation.mealSchedule.join(' → ')}. Lunch is a packed field lunch: the planner offers only
          cold pack options for it.
        </p>
      </Card>

      <Card title="Export">
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={`/api/op/${id}/roster.csv`}>Roster + safety CSV</a>
          <a className="btn-secondary" href={`/api/op/${id}/shopping.csv`}>Shopping list CSV</a>
        </div>
        <p className="mt-2 text-xs text-tr-grey">
          These contain health data on identifiable people. Handle them like the records they are.
        </p>
      </Card>

      <Card title="Danger zone">
        <PurgePanel operationId={id} operationName={operation.name} volunteerCount={volunteers.length} />
      </Card>
    </div>
  );
}
