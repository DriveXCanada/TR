import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { shoppingListForOperation } from '@/lib/shopping-from-menu';
import { setHaveOnHand } from '@/lib/actions/recipes';
import { Card, Stat, Empty, money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ShoppingPage(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const snapshot = await loadSnapshot(id, session);
  const list = shoppingListForOperation(snapshot);
  const { currency } = snapshot.operation;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-tr-charcoal">Shopping list</h1>
        <div className="flex gap-2">
          <a className="btn-secondary" href={`/api/op/${id}/shopping.csv`}>Download CSV</a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Purchase cost" value={money(list.totalCost, currency)} hint="after pack rounding" />
        <Stat label="Operation budget" value={money(list.budget ?? 0, currency)} hint="rate x person-days" />
        <Stat
          label={list.overBudget ? 'Over budget by' : 'Remaining'}
          value={money(Math.abs(list.remaining ?? 0), currency)}
          hint={list.overBudget ? 'reduce the menu or raise the rate' : 'against the whole operation'}
        />
      </div>

      {list.overBudget && (
        <p role="alert" className="rounded-card border border-intolerance-border bg-intolerance-bg p-3 text-sm text-intolerance">
          The shopping list costs more than the operation budget. Purchase cost is higher than the menu&apos;s
          consumption cost because quantities round up to whole packs.
        </p>
      )}

      {(list.missingRecipeIds.length > 0 || list.missingIngredientIds.length > 0) && (
        <p role="alert" className="rounded-card border border-severe-border bg-severe-bg p-3 text-sm text-severe">
          Some planned items could not be priced — {list.missingRecipeIds.length} unknown recipe(s),{' '}
          {list.missingIngredientIds.length} unknown ingredient(s). This list is incomplete until they are fixed.
        </p>
      )}

      {list.lines.length === 0 ? (
        <Empty>Nothing planned yet. Add dishes on the Menu tab and they will appear here.</Empty>
      ) : (
        list.categories.map((category) => (
          <Card key={category.category} title={category.category}
            subtitle={`${category.lines} line${category.lines === 1 ? '' : 's'} · ${money(category.cost, currency)}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-tr-grey">
                    <th className="py-2 pr-3">Ingredient</th>
                    <th className="px-2 py-2 text-right">Required</th>
                    <th className="px-2 py-2 text-right">On hand</th>
                    <th className="px-2 py-2 text-right">To buy</th>
                    <th className="px-2 py-2 text-right">Packs</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                    <th className="px-2 py-2">Used in</th>
                  </tr>
                </thead>
                <tbody>
                  {list.lines.filter((l) => l.category === category.category).map((line) => (
                    <tr key={line.ingredientId} className="border-b border-black/5 align-top">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-tr-charcoal">{line.name}</span>
                        <form action={setHaveOnHand} className="no-print mt-1 flex items-center gap-1">
                          <input type="hidden" name="operationId" value={id} />
                          <input type="hidden" name="ingredientId" value={line.ingredientId} />
                          <input name="haveOnHand" className="input w-24 py-1 text-xs"
                            defaultValue={String(line.haveOnHand)} inputMode="decimal" aria-label={`Have on hand: ${line.name}`} />
                          <button type="submit" className="btn-secondary px-2 py-1 text-xs">Save</button>
                        </form>
                      </td>
                      <td className="px-2 py-2 text-right">{line.requiredQty} {line.unit}</td>
                      <td className="px-2 py-2 text-right text-tr-grey">{line.haveOnHand} {line.unit}</td>
                      <td className="px-2 py-2 text-right font-medium">{line.toBuyQty} {line.unit}</td>
                      <td className="px-2 py-2 text-right">
                        {line.packs === null ? '—' : `${line.packs} x ${line.packSize}${line.packUnit ?? ''}`}
                      </td>
                      <td className="px-2 py-2 text-right">{money(line.cost, currency)}</td>
                      <td className="px-2 py-2 text-xs text-tr-grey">{line.usedIn.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
