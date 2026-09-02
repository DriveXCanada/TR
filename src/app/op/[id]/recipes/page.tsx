import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { RECIPE_CATEGORIES, PACK_TAG } from '@/lib/domain';
import { recipeCostPerServing } from '@/lib/menu-cost';
import { createRecipe, createIngredient, addRecipeIngredient, deleteRecipe } from '@/lib/actions/recipes';
import { Card, Empty, money } from '@/components/ui';
import { StarterLibraryButton } from '../menu/DayTools';

export const dynamic = 'force-dynamic';

export default async function RecipesPage(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, recipes, ingredients } = await loadSnapshot(id, session);

  return (
    <div className="space-y-6">
      <Card
        title="Starter library"
        subtitle="A priced catalogue and recipe book for a field kitchen with limited equipment."
      >
        <StarterLibraryButton operationId={id} recipeCount={recipes.length} />
      </Card>

      <Card title="New recipe" subtitle={`Tag a recipe "${PACK_TAG}" to make it available for the packed field lunch.`}>
        <form action={createRecipe} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="operationId" value={id} />
          <label className="text-sm"><span className="label">Name</span>
            <input name="name" className="input" required /></label>
          <label className="text-sm"><span className="label">Category</span>
            <select name="category" className="input" defaultValue="main">
              {RECIPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">Tags (comma separated)</span>
            <input name="tags" className="input" placeholder="pack, vegetarian, gluten" /></label>
          <label className="text-sm"><span className="label">Burners required</span>
            <input name="burners" className="input" inputMode="numeric" defaultValue="0" /></label>
          <label className="sm:col-span-2 text-sm"><span className="label">Method</span>
            <textarea name="method" rows={2} className="input" /></label>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary">Save recipe</button></div>
        </form>
      </Card>

      <Card title="New ingredient" subtitle="Cost per unit prices the menu; pack size and pack cost drive the shopping list.">
        <form action={createIngredient} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="operationId" value={id} />
          <label className="text-sm"><span className="label">Name</span>
            <input name="name" className="input" required /></label>
          <label className="text-sm"><span className="label">Category</span>
            <input name="category" className="input" defaultValue="pantry" required /></label>
          <label className="text-sm"><span className="label">Unit</span>
            <input name="defaultUnit" className="input" defaultValue="g" required /></label>
          <label className="text-sm"><span className="label">Cost per unit</span>
            <input name="unitCost" className="input" inputMode="decimal" defaultValue="0" /></label>
          <label className="text-sm"><span className="label">Pack size</span>
            <input name="packSize" className="input" inputMode="decimal" placeholder="optional" /></label>
          <label className="text-sm"><span className="label">Pack unit</span>
            <input name="packUnit" className="input" placeholder="optional" /></label>
          <label className="text-sm"><span className="label">Pack cost</span>
            <input name="packCost" className="input" inputMode="decimal" placeholder="optional" /></label>
          <div className="flex items-end"><button type="submit" className="btn-primary">Save ingredient</button></div>
        </form>
      </Card>

      <Card title="Recipe book" subtitle={`${recipes.length} recipes · ${ingredients.length} ingredients`}>
        {recipes.length === 0 ? <Empty>No recipes yet.</Empty> : (
          <ul className="space-y-3">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="rounded-md border border-black/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-tr-charcoal">{recipe.name}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-tr-grey">{recipe.category}</span>
                    <span className="ml-2 text-xs text-tr-grey">
                      {money(recipeCostPerServing(recipe, ingredients), operation.currency)}/serving
                      {recipe.burners > 0 && ` · ${recipe.burners} burner${recipe.burners === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <form action={deleteRecipe}>
                    <input type="hidden" name="operationId" value={id} />
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button type="submit" className="btn-secondary text-xs">Delete</button>
                  </form>
                </div>

                <div className="mt-1 flex flex-wrap gap-1">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className={`chip ${tag === PACK_TAG ? 'border-tr-red/30 bg-tr-red/10 text-tr-red' : 'chip-preference'}`}>
                      {tag}
                    </span>
                  ))}
                </div>

                <ul className="mt-2 text-sm text-tr-ink">
                  {recipe.ingredients.map((line) => (
                    <li key={`${recipe.id}-${line.ingredientId}`}>
                      {line.qtyPerServing} {line.unit} — {line.name}
                    </li>
                  ))}
                  {recipe.ingredients.length === 0 && (
                    <li className="text-tr-grey">No ingredients yet — this recipe cannot be costed or safety-checked.</li>
                  )}
                </ul>

                <form action={addRecipeIngredient} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="operationId" value={id} />
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <label className="text-sm"><span className="label">Ingredient</span>
                    <select name="ingredientId" className="input w-auto" required defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select></label>
                  <label className="text-sm"><span className="label">Qty / serving</span>
                    <input name="qtyPerServing" className="input w-28" inputMode="decimal" defaultValue="0" /></label>
                  <label className="text-sm"><span className="label">Unit</span>
                    <input name="unit" className="input w-20" defaultValue="g" required /></label>
                  <button type="submit" className="btn-secondary">Add</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
