import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { daysBetween, crewForSlot } from '@/lib/presence';
import { SLOTS, SEVERITY_RANK, type Slot } from '@/lib/domain';
import { costMenu, offerableRecipes, servingsFor } from '@/lib/menu-cost';
import { budgetSummary } from '@/lib/budget';
import { checkConflicts } from '@/lib/conflict';
import { addDish, removeDish, setServings } from '@/lib/actions/menu';
import { SlotSelector } from '@/components/SlotSelector';
import { Card, Stat, SeverityChip, money } from '@/components/ui';
import { WeekOverview } from './WeekOverview';
import { CopyDayForm, StarterLibraryButton } from './DayTools';

export const dynamic = 'force-dynamic';

export default async function MenuPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const snapshot = await loadSnapshot(id, session);
  const { operation, volunteers, recipes, ingredients, menu } = snapshot;
  const { days, day } = resolveSelection(operation.startDate, operation.endDate, await searchParams);

  const allDays = daysBetween(operation.startDate, operation.endDate);
  const costs = costMenu(menu, recipes, ingredients, volunteers, operation, allDays);
  const today = costs.find((c) => c.day === day);
  const opTotalCost = costs.reduce((s, d) => s + d.cost, 0);
  const opBudget = budgetSummary(volunteers, operation.startDate, operation.endDate,
    operation.perPersonPerDay, operation.currency, operation.mealSchedule);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  // A brand-new operation has no catalogue, so the planner can offer nothing.
  // Say so and give a one-click way out rather than showing empty pickers.
  if (recipes.length === 0) {
    return (
      <div className="space-y-6">
        <Card title="Nothing to plan with yet" subtitle="This operation has no recipes or ingredients.">
          <p className="mb-4 text-sm text-tr-silver">
            The planner needs a recipe book before it can do anything. Load the standard field-kitchen
            library to start planning immediately, or build your own from the <strong>Recipes</strong> tab.
          </p>
          <StarterLibraryButton operationId={id} recipeCount={0} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SlotSelector days={days} slots={SLOTS} day={day} slot="supper" />

      <Card title="The whole operation" subtitle="Every day and slot at a glance. Click a date to edit it.">
        <WeekOverview opId={id} days={costs} selectedDay={day} currency={operation.currency} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Day food cost" value={money(today?.cost ?? 0, operation.currency)}
          hint={`Day budget ${money(today?.budget ?? 0, operation.currency)}`} />
        <Stat label="Operation food cost" value={money(opTotalCost, operation.currency)}
          hint="consumption at unit price" />
        <Stat label="Operation budget" value={money(opBudget.totalBudget, operation.currency)}
          hint={`${money(operation.perPersonPerDay, operation.currency)} x ${opBudget.totalPeopleDays} person-days`} />
      </div>

      {today !== undefined && today.overBudget && (
        <p role="alert" className="rounded-card border border-intolerance-border bg-intolerance-bg p-3 text-sm text-intolerance">
          {day} is over its daily budget by {money(today.cost - today.budget, operation.currency)}.
        </p>
      )}

      <Card title={`Roll ${day} forward`} subtitle="Plan one good day, then apply it across the operation.">
        <CopyDayForm operationId={id} fromDay={day} days={allDays} />
      </Card>

      {SLOTS.map((slot) => {
        const slotCost = today?.slots.find((s) => s.slot === slot);
        const existing = menu.find((m) => m.day === day && m.slot === slot);
        const crew = crewForSlot(volunteers, day, slot, operation.mealSchedule);
        const defaults = existing === undefined
          ? { servings: crew.length, isDefault: true }
          : servingsFor(existing, volunteers, operation);
        const options = offerableRecipes(recipes, slot as Slot);

        // Conflicts for what is actually planned into this slot, against the
        // crew actually in the line for it.
        const plannedIngredients = (slotCost?.dishes ?? []).flatMap((d) => {
          const r = d.recipeId === null ? undefined : recipeById.get(d.recipeId);
          return r === undefined ? [d.name] : [r.name, ...r.ingredients.map((i) => i.name)];
        });
        const report = checkConflicts(plannedIngredients, crew);
        const severe = report.conflicts.filter((c) => c.severity === 'severe');

        return (
          <Card
            key={slot}
            title={slot}
            subtitle={
              slot === 'lunch'
                ? 'Packed field lunch — cold only. The picker offers pack options exclusively.'
                : `${crew.length} in the line · ${money(slotCost?.cost ?? 0, operation.currency)}`
            }
          >
            {severe.length > 0 && (
              <p role="alert" className="mb-3 rounded-md border-2 border-severe-border bg-severe-bg p-2 text-sm font-semibold text-severe">
                ▲ {severe.length} SEVERE conflict{severe.length === 1 ? '' : 's'} with what is planned here:{' '}
                {[...new Set(severe.map((c) => `${c.volunteerName} (${c.tag})`))].join(', ')}
              </p>
            )}

            <ul className="mb-3 space-y-2">
              {(slotCost?.dishes ?? []).map((dish) => {
                const recipe = dish.recipeId === null ? undefined : recipeById.get(dish.recipeId);
                const dishConflicts = recipe === undefined ? [] : [...checkConflicts(
                  [recipe.name, ...recipe.ingredients.map((i) => i.name)], crew,
                ).conflicts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
                return (
                  <li key={dish.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-tr-line p-2">
                    <div>
                      <span className="font-medium text-tr-white">{dish.name}</span>
                      <span className="ml-2 text-xs text-tr-grey">{money(dish.cost, operation.currency)}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {[...new Map(dishConflicts.map((c) => [`${c.severity}-${c.tag}`, c])).values()].map((c) => (
                          <SeverityChip key={`${c.severity}-${c.tag}`} severity={c.severity}>{c.tag}</SeverityChip>
                        ))}
                      </div>
                    </div>
                    <form action={removeDish}>
                      <input type="hidden" name="operationId" value={id} />
                      <input type="hidden" name="itemId" value={dish.id} />
                      <button type="submit" className="btn-secondary text-xs">Remove</button>
                    </form>
                  </li>
                );
              })}
              {(slotCost?.dishes ?? []).length === 0 && (
                <li className="text-sm text-tr-grey">Nothing planned for this slot.</li>
              )}
            </ul>

            <div className="flex flex-wrap items-end gap-3">
              <form action={addDish} className="flex items-end gap-2">
                <input type="hidden" name="operationId" value={id} />
                <input type="hidden" name="day" value={day} />
                <input type="hidden" name="slot" value={slot} />
                <label className="text-sm">
                  <span className="label">Add a dish</span>
                  <select name="recipeId" className="input w-auto" required defaultValue="">
                    <option value="" disabled>Choose…</option>
                    {options.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <button type="submit" className="btn-primary">Add</button>
              </form>

              <form action={setServings} className="flex items-end gap-2">
                <input type="hidden" name="operationId" value={id} />
                <input type="hidden" name="day" value={day} />
                <input type="hidden" name="slot" value={slot} />
                <label className="text-sm">
                  <span className="label">Servings</span>
                  <input
                    name="servings" className="input w-28" inputMode="numeric"
                    placeholder={String(defaults.servings)}
                    defaultValue={defaults.isDefault ? '' : String(defaults.servings)}
                  />
                </label>
                <button type="submit" className="btn-secondary">Set</button>
              </form>
              <p className="text-xs text-tr-grey">
                {defaults.isDefault
                  ? `Following headcount (${defaults.servings}). Leave blank to keep it that way.`
                  : `Overridden to ${defaults.servings}. Clear the field to follow headcount again.`}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
