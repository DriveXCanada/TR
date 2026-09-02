/**
 * Bridges the stored menu into the pure `buildShoppingList` input, so the
 * builder itself stays free of database types and remains unit-testable.
 */
import { buildShoppingList, type PlannedDish, type ShoppingList } from './shopping';
import { servingsFor } from './menu-cost';
import { budgetSummary } from './budget';
import type { OperationSnapshot } from './data/access';

export function shoppingListForOperation(snapshot: OperationSnapshot): ShoppingList {
  const { operation, volunteers, recipes, ingredients, menu } = snapshot;

  const dishes: PlannedDish[] = [];
  for (const slot of menu) {
    const { servings } = servingsFor(slot, volunteers, operation);
    for (const item of slot.items) {
      if (item.recipeId === null) continue;
      dishes.push({ day: slot.day, slot: slot.slot, recipeId: item.recipeId, servings });
    }
  }

  const budget = budgetSummary(
    volunteers, operation.startDate, operation.endDate,
    operation.perPersonPerDay, operation.currency, operation.mealSchedule,
  );

  return buildShoppingList({
    dishes,
    recipes: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      ingredients: r.ingredients.map((i) => ({
        ingredientId: i.ingredientId, qtyPerServing: i.qtyPerServing, unit: i.unit,
      })),
    })),
    ingredients: ingredients.map((i) => ({
      id: i.id, name: i.name, category: i.category, defaultUnit: i.defaultUnit,
      unitCost: i.unitCost, packSize: i.packSize, packUnit: i.packUnit,
      packCost: i.packCost, haveOnHand: i.haveOnHand,
    })),
    budget: budget.totalBudget,
  });
}
