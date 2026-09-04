import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { daysBetween, isPresentOnDay } from '@/lib/presence';
import { ICS_ROLES } from '@/lib/domain';
import { Card } from '@/components/ui';
import { toggleKitExemptRole } from '@/lib/actions/settings';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers, demands } = await loadSnapshot(id, session);
  const days = daysBetween(operation.startDate, operation.endDate);

  const target = new Map(demands.map((d) => [`${d.icsRole}|${d.day}`, d.target]));
  const roles = ICS_ROLES.filter((role) =>
    volunteers.some((v) => v.icsRole === role) || demands.some((d) => d.icsRole === role));

  const exempt = new Set(operation.kitExemptRoles);

  return (
    <div className="space-y-6">
      <Card
        title="Who draws kit"
        subtitle="Some roles are on site and eating but never draw PPE. Turn them off here and they leave the inventory counts."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => {
            const off = exempt.has(role);
            const headcount = volunteers.filter((v) => v.icsRole === role).length;
            return (
              <li key={role} className={`flex items-center justify-between gap-3 rounded border p-2 ${
                off ? 'border-tr-line bg-tr-charcoal' : 'border-tr-line bg-tr-slate'
              }`}>
                <span>
                  <span className={`font-bold ${off ? 'text-tr-grey line-through' : 'text-tr-white'}`}>{role}</span>
                  <span className="ml-2 text-xs text-tr-grey">{headcount} on roster</span>
                </span>
                <form action={toggleKitExemptRole}>
                  <input type="hidden" name="operationId" value={id} />
                  <input type="hidden" name="role" value={role} />
                  <button
                    type="submit"
                    data-testid={`kit-toggle-${role.replace(/\s+/g, '-')}`}
                    className={off ? 'btn-secondary px-2 py-1 text-xs' : 'btn-primary px-2 py-1 text-xs'}
                  >
                    {off ? 'Not drawing kit' : 'Draws kit'}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-tr-grey">
          This affects <strong className="text-tr-silver">PPE and inventory only</strong>. Everyone on site is
          still counted for food, every meal — a role that does not need gloves still needs supper.
        </p>
      </Card>

      <Card title="Staffing — demand vs actual" subtitle="Target per ICS role per day, against who is actually on site.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-tr-line text-left text-xs uppercase tracking-wide text-tr-grey">
              <th className="py-2 pr-3">Role</th>
              {days.map((d) => <th key={d} className="px-2 py-2 text-center font-medium">{d.slice(5)}</th>)}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role} className="border-b border-tr-line">
                <td className="py-2 pr-3 font-medium text-tr-white">{role}</td>
                {days.map((d) => {
                  const actual = volunteers.filter((v) =>
                    v.icsRole === role && isPresentOnDay(v, d, operation.mealSchedule)).length;
                  const want = target.get(`${role}|${d}`) ?? 0;
                  const short = want > 0 && actual < want;
                  return (
                    <td key={d} className="px-2 py-2 text-center">
                      <span className={short ? 'font-semibold text-severe' : 'text-tr-silver'}>{actual}</span>
                      <span className="text-tr-grey">/{want}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        <p className="mt-3 text-xs text-tr-grey">Red means under the target for that day.</p>
      </Card>
    </div>
  );
}
