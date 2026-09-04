import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { daysBetween } from '@/lib/presence';
import { SLOTS } from '@/lib/domain';
import { needForDay, planItems, ISSUE_POLICY_LABELS, KIT_CATEGORIES } from '@/lib/kit';
import { KIT_TEMPLATES } from '@/lib/kit-templates';
import { loadKitTemplate, setStock, updateKitItem, deleteKitItem } from '@/lib/actions/kit';
import { ISSUE_POLICIES } from '@/lib/kit';
import { SIZE_SCHEMES, SCHEMES } from '@/lib/sizes';
import { SlotSelector } from '@/components/SlotSelector';
import { Card } from '@/components/ui';
import { NewItemForm } from './InventoryForms';

export const dynamic = 'force-dynamic';

export default async function InventoryPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers, kit } = await loadSnapshot(id, session);
  const { days, day } = resolveSelection(operation.startDate, operation.endDate, await searchParams);

  const allDays = daysBetween(operation.startDate, operation.endDate);
  const todayIso = new Date().toISOString().slice(0, 10);
  const needs = needForDay(kit, volunteers, day, operation.startDate, operation.mealSchedule);
  const plans = planItems(kit, volunteers, operation.startDate, operation.endDate, todayIso, operation.mealSchedule);
  const urgent = plans.filter((p) => p.urgent);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-tr-red-bright">Logistics</p>
          <h1 className="mt-1 text-2xl font-black uppercase text-tr-white">Inventory</h1>
        </div>
        <SlotSelector days={days} slots={SLOTS} day={day} slot="supper" />
      </header>

      {urgent.length > 0 && (
        <div role="alert" className="alarm">
          <h2 className="alarm-title"><span aria-hidden>▲</span> Order now — {urgent.length} item(s)</h2>
          <p className="mt-1 text-sm text-severe">
            Past the order date once lead time is counted back, or already at the reorder level.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {urgent.map((p) => (
              <li key={p.item.id} className="rounded border border-severe-border bg-tr-slate p-2">
                <span className="font-bold text-tr-white">{p.item.name}</span>
                <span className="ml-2 text-tr-silver">
                  short {p.shortfall} {p.item.unit}
                  {p.runsOutOn !== null && ` · runs out ${p.runsOutOn}`}
                  {p.orderBy !== null && ` · order by ${p.orderBy} (${p.item.leadTimeDays}d lead)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kit.length === 0 ? (
        <Card title="No kit list yet" subtitle="Start from a standard loadout rather than a blank page.">
          <TemplateButtons operationId={id} />
        </Card>
      ) : (
        <Card title={`Needed on ${day}`} subtitle="What actually gets handed out that day, and why.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-tr-line text-left">
                  <th className="py-2 pr-3 eyebrow">Item</th>
                  <th className="px-2 py-2 eyebrow">Issue</th>
                  <th className="px-2 py-2 eyebrow text-right">Needed</th>
                  <th className="px-2 py-2 eyebrow">Basis</th>
                  <th className="px-2 py-2 eyebrow">Sizes</th>
                </tr>
              </thead>
              <tbody>
                {needs.map((need) => (
                  <tr key={need.item.id} className="border-b border-tr-line align-top">
                    <td className="py-2 pr-3">
                      <span className="font-bold text-tr-white">{need.item.name}</span>
                      <span className="ml-2 text-xs uppercase text-tr-grey">{need.item.category}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`chip ${need.item.issuePolicy === 'single_use' ? 'chip-brand' : 'chip-preference'}`}>
                        {need.item.issuePolicy === 'single_use' ? 'single use'
                          : need.item.issuePolicy === 'per_deployment' ? 'once'
                            : `every ${need.item.intervalDays}d`}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-tr-white">
                      {need.qty > 0 ? `${need.qty} ${need.item.unit}` : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs text-tr-grey">{need.basis}</td>
                    <td className="px-2 py-2 text-xs">
                      {need.sizes.length === 0 ? <span className="text-tr-grey">one size</span> : need.sizes.map((t) => (
                        <span key={t.scheme}>
                          {t.counts.filter((c) => c.count > 0).map((c) => `${c.size}×${c.count}`).join(' · ') || '—'}
                          {t.unknown > 0 && <span className="ml-2 text-intolerance">{t.unknown} unknown</span>}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {kit.length > 0 && (
        <Card title="Whole operation" subtitle={`${allDays.length} days. Stock is what you have now; shortfall is what to buy.`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-tr-line text-left">
                  <th className="py-2 pr-3 eyebrow">Item</th>
                  <th className="px-2 py-2 eyebrow text-right">Total need</th>
                  <th className="px-2 py-2 eyebrow">Stock on hand</th>
                  <th className="px-2 py-2 eyebrow text-right">Shortfall</th>
                  <th className="px-2 py-2 eyebrow">Runs out</th>
                  <th className="px-2 py-2 eyebrow">Order by</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.item.id} className={`border-b border-tr-line align-top ${plan.urgent ? 'bg-severe-bg/40' : ''}`}>
                    <td className="py-2 pr-3 font-bold text-tr-white">{plan.item.name}</td>
                    <td className="px-2 py-2 text-right">{plan.totalQty} {plan.item.unit}</td>
                    <td className="px-2 py-2">
                      <form action={setStock} className="flex items-center gap-1">
                        <input type="hidden" name="operationId" value={id} />
                        <input type="hidden" name="itemId" value={plan.item.id} />
                        <input
                          name="stockOnHand" className="input w-24 py-1 text-sm" inputMode="decimal"
                          defaultValue={String(plan.stockOnHand)} aria-label={`Stock on hand: ${plan.item.name}`}
                        />
                        <button type="submit" className="btn-secondary px-2 py-1 text-xs">Set</button>
                      </form>
                    </td>
                    <td className={`px-2 py-2 text-right font-bold ${plan.shortfall > 0 ? 'text-severe' : 'text-ok'}`}>
                      {plan.shortfall > 0 ? plan.shortfall : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs text-tr-grey">{plan.runsOutOn ?? 'covered'}</td>
                    <td className={`px-2 py-2 text-xs ${plan.urgent ? 'font-bold text-severe' : 'text-tr-grey'}`}>
                      {plan.orderBy ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-tr-grey">
            &ldquo;Order by&rdquo; counts the lead time back from the day stock runs out. Knowing you run out on
            Thursday is no use on Wednesday if delivery takes two days.
          </p>
        </Card>
      )}

      <Card title="Standard loadouts" subtitle="Additive and matched by name — safe to run twice, and layering a task template on the general one never duplicates the base PPE.">
        <TemplateButtons operationId={id} />
      </Card>

      <Card title="Add an item">
        <NewItemForm operationId={id} />
      </Card>

      {kit.length > 0 && (
        <Card title="Edit items" subtitle="Change how something is issued, its size scheme, or remove it.">
          <ul className="space-y-3">
            {kit.map((k) => (
              <li key={k.id} className="rounded border border-tr-line p-3">
                <form action={updateKitItem} className="grid gap-2 sm:grid-cols-6">
                  <input type="hidden" name="operationId" value={id} />
                  <input type="hidden" name="itemId" value={k.id} />
                  <label className="text-xs sm:col-span-2"><span className="label">Item</span>
                    <input name="name" className="input py-1 text-sm" defaultValue={k.name} required /></label>
                  <label className="text-xs"><span className="label">Category</span>
                    <select name="category" className="input py-1 text-sm" defaultValue={k.category}>
                      {KIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select></label>
                  <label className="text-xs sm:col-span-2"><span className="label">Issue</span>
                    <select name="issuePolicy" className="input py-1 text-sm" defaultValue={k.issuePolicy}>
                      {ISSUE_POLICIES.map((p) => <option key={p} value={p}>{ISSUE_POLICY_LABELS[p]}</option>)}
                    </select></label>
                  <label className="text-xs"><span className="label">Every N days</span>
                    <input name="intervalDays" className="input py-1 text-sm" inputMode="numeric" defaultValue={String(k.intervalDays)} /></label>
                  <label className="text-xs"><span className="label">Qty / person</span>
                    <input name="qtyPerPerson" className="input py-1 text-sm" inputMode="decimal" defaultValue={String(k.qtyPerPerson)} /></label>
                  <label className="text-xs"><span className="label">Unit</span>
                    <input name="unit" className="input py-1 text-sm" defaultValue={k.unit} required /></label>
                  <label className="text-xs"><span className="label">Sized</span>
                    <select name="sizeScheme" className="input py-1 text-sm" defaultValue={k.sizeScheme ?? ''}>
                      <option value="">One size</option>
                      {SIZE_SCHEMES.map((s) => <option key={s} value={s}>{SCHEMES[s].label}</option>)}
                    </select></label>
                  <label className="text-xs"><span className="label">Stock</span>
                    <input name="stockOnHand" className="input py-1 text-sm" inputMode="decimal" defaultValue={String(k.stockOnHand)} /></label>
                  <label className="text-xs"><span className="label">Reorder at</span>
                    <input name="reorderLevel" className="input py-1 text-sm" inputMode="decimal" defaultValue={String(k.reorderLevel)} /></label>
                  <label className="text-xs"><span className="label">Lead days</span>
                    <input name="leadTimeDays" className="input py-1 text-sm" inputMode="numeric" defaultValue={String(k.leadTimeDays)} /></label>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <button type="submit" className="btn-secondary px-2 py-1 text-xs">Save</button>
                  </div>
                </form>
                <form action={deleteKitItem} className="mt-2">
                  <input type="hidden" name="operationId" value={id} />
                  <input type="hidden" name="itemId" value={k.id} />
                  <button type="submit" className="text-xs text-tr-grey underline hover:text-severe">Remove {k.name}</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TemplateButtons({ operationId }: { operationId: string }): React.ReactNode {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {KIT_TEMPLATES.map((template) => (
        <form key={template.key} action={loadKitTemplate} className="rounded border border-tr-line p-3">
          <input type="hidden" name="operationId" value={operationId} />
          <input type="hidden" name="templateKey" value={template.key} />
          <h3 className="font-bold uppercase tracking-wide text-tr-white">{template.label}</h3>
          <p className="mt-1 text-xs text-tr-grey">{template.blurb}</p>
          <p className="mt-1 text-xs text-tr-grey">{template.items.length} items</p>
          <button type="submit" className="btn-secondary mt-2" data-testid={`load-${template.key}`}>
            Load {template.label}
          </button>
        </form>
      ))}
    </div>
  );
}
