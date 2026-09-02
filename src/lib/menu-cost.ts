/**
 * Menu costing.
 *
 * This is CONSUMPTION cost — what the food on the plate is worth at unit price.
 * The shopping list reports PURCHASE cost, which is higher because it rounds up
 * to whole packs. Both are shown, labelled, because a planner comparing a menu
 * against a day budget wants the former and a buyer at the wholesaler wants the
 * latter. Quietly showing one as the other would misstate the budget.
 */
import { round2 } from './budget';
import { isMeal, type Slot } from './domain';
import { crewForSlot, type Stay } from './presence';
import type { IngredientView, MenuSlotView, RecipeView, OperationView, VolunteerView } from './data/access';

export interface SlotCost {
  readonly slotId: string;
  readonly day: string;
  readonly slot: Slot;
  readonly servings: number;
  readonly servingsAreDefault: boolean;
  readonly dishes: readonly { id: string; name: string; recipeId: string | null; cost: number }[];
  readonly cost: number;
}

export interface DayCost {
  readonly day: string;
  readonly slots: readonly SlotCost[];
  readonly cost: number;
  readonly budget: number;
  readonly overBudget: boolean;
}

/** Cost of one serving of a recipe at unit prices. */
export function recipeCostPerServing(recipe: RecipeView, ingredients: readonly IngredientView[]): number {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return round2(recipe.ingredients.reduce((sum, line) => {
    const ingredient = byId.get(line.ingredientId);
    if (ingredient === undefined) return sum;
    return sum + line.qtyPerServing * ingredient.unitCost;
  }, 0));
}

/** Servings for a slot: the explicit override, else the headcount in the line. */
export function servingsFor(
  slot: MenuSlotView,
  volunteers: readonly (VolunteerView & Stay)[],
  operation: OperationView,
): { servings: number; isDefault: boolean } {
  if (slot.servings !== null) return { servings: slot.servings, isDefault: false };
  return {
    servings: crewForSlot(volunteers, slot.day, slot.slot, operation.mealSchedule).length,
    isDefault: true,
  };
}

export function costMenu(
  menu: readonly MenuSlotView[],
  recipes: readonly RecipeView[],
  ingredients: readonly IngredientView[],
  volunteers: readonly (VolunteerView & Stay)[],
  operation: OperationView,
  days: readonly string[],
): DayCost[] {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const perServing = new Map(recipes.map((r) => [r.id, recipeCostPerServing(r, ingredients)]));

  return days.map((day) => {
    const slots = menu.filter((m) => m.day === day).map((m): SlotCost => {
      const { servings, isDefault } = servingsFor(m, volunteers, operation);
      const dishes = m.items.map((item) => {
        const recipe = item.recipeId === null ? undefined : recipeById.get(item.recipeId);
        const unit = item.recipeId === null ? 0 : (perServing.get(item.recipeId) ?? 0);
        return {
          id: item.id,
          name: recipe?.name ?? item.adHocName ?? 'Unnamed dish',
          recipeId: item.recipeId,
          cost: round2(unit * servings),
        };
      });
      return {
        slotId: m.id, day, slot: m.slot, servings, servingsAreDefault: isDefault,
        dishes, cost: round2(dishes.reduce((s, d) => s + d.cost, 0)),
      };
    }).sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));

    const cost = round2(slots.reduce((s, x) => s + x.cost, 0));
    const people = crewForSlotAnyMeal(volunteers, day, operation);
    const budget = round2(operation.perPersonPerDay * people);
    return { day, slots, cost, budget, overBudget: cost > budget };
  });
}

function crewForSlotAnyMeal(
  volunteers: readonly (VolunteerView & Stay)[], day: string, operation: OperationView,
): number {
  const seen = new Set<string>();
  for (const meal of operation.mealSchedule) {
    for (const v of crewForSlot(volunteers, day, meal, operation.mealSchedule)) seen.add(v.id);
  }
  return seen.size;
}

const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, supper: 2, snack: 3, drinks: 4 };
function slotOrder(slot: Slot): number { return SLOT_ORDER[slot] ?? 99; }

/**
 * Recipes offerable in a slot. Lunch is a packed field lunch with no hot
 * service, so it accepts only `pack` recipes — the constraint is enforced here
 * and in the server action, not just hidden in the UI.
 */
export function offerableRecipes(recipes: readonly RecipeView[], slot: Slot): RecipeView[] {
  if (slot === 'lunch') return recipes.filter((r) => r.tags.includes('pack'));
  if (slot === 'drinks') return recipes.filter((r) => r.category === 'drink');
  if (slot === 'snack') return recipes.filter((r) => r.category === 'snack');
  return recipes.filter((r) => isMeal(slot) ? r.category === 'main' || r.category === 'side' : true);
}
