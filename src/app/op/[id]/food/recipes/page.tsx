import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { RECIPE_CATEGORIES, PACK_TAG } from '@/lib/domain';
import { recipeCostPerServing } from '@/lib/menu-cost';
import { tagsFor } from '@/lib/allergens';
import {
  createRecipe, createIngredient, addRecipeIngredient, deleteRecipe,
  updateRecipe, removeRecipeIngredient, updateRecipeIngredient,
  addIngredientsFromText, setIngredientPrice, copyRecipe,
} from '@/lib/actions/recipes';
import { Card, Empty, money } from '@/components/ui';
import { StarterLibraryButton } from '../menu/DayTools';

export const dynamic = 'force-dynamic';

/** Splits a "a|b|c" query parameter back into names. */
function names(value: string | string[] | undefined): string[] {
  if (typeof value !== 'string' || value === '') return [];
  return value.split('|').filter((v) => v !== '');
}

export default async function RecipesPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const q = await searchParams;
  const { operation, recipes, ingredients } = await loadSnapshot(id, session);

  const created = names(q.created);
  const unchecked = names(q.unchecked);
  const unreadable = names(q.unreadable);
  const added = typeof q.added === 'string' ? q.added : null;
  const pasteFailed = q.paste === 'none';

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  /** Ingredients a recipe uses that still cost nothing — the menu understates the budget until priced. */
  const usedIds = new Set(recipes.flatMap((r) => r.ingredients.map((l) => l.ingredientId)));
  const unpriced = ingredients.filter((i) => usedIds.has(i.id) && i.unitCost === 0 && i.packCost === null);

  return (
    <div className="space-y-6">
      {(added !== null || pasteFailed) && (
        <div className="rounded-md border border-tr-line bg-tr-charcoal p-4 text-sm">
          {pasteFailed ? (
            <p className="font-semibold text-tr-red-bright">
              Nothing could be read from that list. Write one ingredient per line, like
              {' '}<span className="font-mono">60 g rolled oats</span>.
            </p>
          ) : (
            <p className="font-semibold text-tr-white">{added} ingredient{added === '1' ? '' : 's'} written to the recipe.</p>
          )}
          {created.length > 0 && (
            <p className="mt-2 text-tr-silver">
              Created as new ingredients with <strong className="text-tr-white">no price</strong>, so the recipe
              costs less than it really does until you price them: {created.join(', ')}.
            </p>
          )}
          {unchecked.length > 0 && (
            <p className="mt-2 rounded border border-severe/60 bg-severe/15 p-2 text-tr-white">
              <strong className="uppercase tracking-wide text-severe-bright">Check by hand:</strong>{' '}
              the allergen list does not recognise {unchecked.join(', ')}. The safety check cannot warn about
              {' '}{unchecked.length === 1 ? 'it' : 'them'}. Read the label and confirm against the roster yourself.
            </p>
          )}
          {unreadable.length > 0 && (
            <p className="mt-2 text-tr-silver">
              Skipped {unreadable.length} line{unreadable.length === 1 ? '' : 's'} that could not be read:{' '}
              <span className="font-mono">{unreadable.join(' · ')}</span>
            </p>
          )}
        </div>
      )}

      {unpriced.length > 0 && (
        <Card title="Ingredients with no price" subtitle="These appear in a recipe but cost nothing, so the menu and the budget are understated.">
          <ul className="space-y-2">
            {unpriced.map((i) => (
              <li key={i.id}>
                <form action={setIngredientPrice} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="operationId" value={id} />
                  <input type="hidden" name="ingredientId" value={i.id} />
                  <span className="min-w-32 pb-2 text-sm font-semibold text-tr-white">{i.name}</span>
                  <label className="text-sm"><span className="label">Cost per {i.defaultUnit}</span>
                    <input name="unitCost" className="input w-24" inputMode="decimal" defaultValue="0" /></label>
                  <label className="text-sm"><span className="label">Pack size</span>
                    <input name="packSize" className="input w-24" inputMode="decimal" placeholder="optional" /></label>
                  <label className="text-sm"><span className="label">Pack unit</span>
                    <input name="packUnit" className="input w-24" placeholder="optional" /></label>
                  <label className="text-sm"><span className="label">Pack cost</span>
                    <input name="packCost" className="input w-24" inputMode="decimal" placeholder="optional" /></label>
                  <button type="submit" className="btn-secondary">Save price</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="New recipe" subtitle={`Name it, save it, then write the ingredients in one go. Tag a recipe "${PACK_TAG}" to offer it as the packed field lunch.`}>
        <form action={createRecipe} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="operationId" value={id} />
          <label className="text-sm"><span className="label">Name</span>
            <input name="name" className="input" required placeholder="Camp chilli" /></label>
          <label className="text-sm"><span className="label">Category</span>
            <select name="category" className="input" defaultValue="main">
              {RECIPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">Tags (comma separated)</span>
            <input name="tags" className="input" placeholder="pack, vegetarian" /></label>
          <label className="text-sm"><span className="label">Burners required</span>
            <input name="burners" className="input" inputMode="numeric" defaultValue="0" /></label>
          <label className="sm:col-span-2 text-sm"><span className="label">Method</span>
            <textarea name="method" rows={2} className="input" placeholder="How it is cooked, and anything the next cook needs to know." /></label>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary">Save recipe</button></div>
        </form>
      </Card>

      <Card title="Recipe book" subtitle={`${recipes.length} recipes · ${ingredients.length} ingredients`}>
        {recipes.length === 0 ? <Empty>No recipes yet.</Empty> : (
          <ul className="space-y-4">
            {recipes.map((recipe) => {
              const cost = recipeCostPerServing(recipe, ingredients);
              return (
                <li key={recipe.id} id={`recipe-${recipe.id}`} className="rounded-md border border-tr-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-tr-white">{recipe.name}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-tr-grey">{recipe.category}</span>
                      <span className="ml-2 text-xs text-tr-grey">
                        {money(cost, operation.currency)}/serving
                        {recipe.burners > 0 && ` · ${recipe.burners} burner${recipe.burners === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <form action={copyRecipe}>
                        <input type="hidden" name="operationId" value={id} />
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <button type="submit" className="btn-secondary text-xs">Duplicate</button>
                      </form>
                      <form action={deleteRecipe}>
                        <input type="hidden" name="operationId" value={id} />
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <button type="submit" className="btn-secondary text-xs">Delete</button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className={`chip ${tag === PACK_TAG ? 'border-tr-red/50 bg-tr-red/15 text-tr-red-bright' : 'chip-preference'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Each line is editable in place; previously a wrong quantity meant rebuilding the recipe. */}
                  <ul className="mt-3 space-y-1">
                    {recipe.ingredients.map((line) => {
                      const ing = byId.get(line.ingredientId);
                      const knownAllergens = tagsFor(line.name);
                      return (
                        <li key={`${recipe.id}-${line.ingredientId}`} className="flex flex-wrap items-end gap-2">
                          <form action={updateRecipeIngredient} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="operationId" value={id} />
                            <input type="hidden" name="recipeId" value={recipe.id} />
                            <input type="hidden" name="ingredientId" value={line.ingredientId} />
                            <input
                              name="qtyPerServing"
                              className="input w-20"
                              inputMode="decimal"
                              defaultValue={String(line.qtyPerServing)}
                              aria-label={`Quantity of ${line.name} per serving`}
                            />
                            <input
                              name="unit"
                              className="input w-20"
                              defaultValue={line.unit}
                              required
                              aria-label={`Unit for ${line.name}`}
                            />
                            <span className="pb-2 text-sm text-tr-silver">
                              {line.name}
                              {knownAllergens.length > 0 && (
                                <span className="ml-2 text-xs uppercase tracking-wide text-severe-bright">
                                  {[...new Set(knownAllergens.map((h) => h.tag))].join(' · ')}
                                </span>
                              )}
                              {ing !== undefined && ing.unitCost === 0 && ing.packCost === null && (
                                <span className="ml-2 text-xs text-tr-grey">no price</span>
                              )}
                            </span>
                            <button
                              type="submit"
                              className="btn-secondary text-xs"
                              aria-label={`Save ${line.name} line`}
                            >
                              Save
                            </button>
                          </form>
                          <form action={removeRecipeIngredient}>
                            <input type="hidden" name="operationId" value={id} />
                            <input type="hidden" name="recipeId" value={recipe.id} />
                            <input type="hidden" name="ingredientId" value={line.ingredientId} />
                            <button type="submit" className="btn-secondary text-xs" aria-label={`Remove ${line.name} from ${recipe.name}`}>
                              Remove
                            </button>
                          </form>
                        </li>
                      );
                    })}
                    {recipe.ingredients.length === 0 && (
                      <li className="text-sm text-tr-grey">No ingredients yet — this recipe cannot be costed or safety-checked.</li>
                    )}
                  </ul>

                  <details className="mt-3 rounded border border-tr-line bg-tr-charcoal/60 p-2" open={recipe.ingredients.length === 0}>
                    <summary className="cursor-pointer text-sm font-semibold text-tr-white">Write the ingredient list</summary>
                    <form action={addIngredientsFromText} className="mt-2 space-y-2">
                      <input type="hidden" name="operationId" value={id} />
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <label className="block text-sm">
                        <span className="label">One ingredient per line, per serving</span>
                        <textarea
                          name="text"
                          rows={6}
                          className="input font-mono text-sm"
                          aria-label={`Ingredient list for ${recipe.name}`}
                          placeholder={'120 g dried kidney beans\n80 g onion\n2 cloves garlic\n1 tin chopped tomatoes\n15 ml vegetable oil\nsalt'}
                        />
                      </label>
                      <p className="text-xs text-tr-grey">
                        Quantities are per serving — the kitchen scales them to the headcount. Ingredients that
                        do not exist yet are created; anything already in the list keeps its price. A repeated
                        ingredient replaces its line rather than adding a second one.
                      </p>
                      <button type="submit" className="btn-primary" aria-label={`Write ingredients for ${recipe.name}`}>
                        Write ingredients
                      </button>
                    </form>
                  </details>

                  <details className="mt-2 rounded border border-tr-line bg-tr-charcoal/60 p-2">
                    <summary className="cursor-pointer text-sm font-semibold text-tr-white">Edit name, tags and method</summary>
                    <form action={updateRecipe} className="mt-2 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="operationId" value={id} />
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <label className="text-sm"><span className="label">Name</span>
                        <input name="name" className="input" required defaultValue={recipe.name} /></label>
                      <label className="text-sm"><span className="label">Category</span>
                        <select name="category" className="input" defaultValue={recipe.category}>
                          {RECIPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select></label>
                      <label className="text-sm"><span className="label">Tags (comma separated)</span>
                        <input name="tags" className="input" defaultValue={recipe.tags.join(', ')} /></label>
                      <label className="text-sm"><span className="label">Burners required</span>
                        <input name="burners" className="input" inputMode="numeric" defaultValue={String(recipe.burners)} /></label>
                      <label className="sm:col-span-2 text-sm"><span className="label">Method</span>
                        <textarea name="method" rows={4} className="input" defaultValue={recipe.method ?? ''} /></label>
                      <div className="sm:col-span-2"><button type="submit" className="btn-primary">Save changes</button></div>
                    </form>
                  </details>

                  <details className="mt-2 rounded border border-tr-line bg-tr-charcoal/60 p-2">
                    <summary className="cursor-pointer text-sm text-tr-grey">Add one priced ingredient from the catalogue</summary>
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
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Starter library" subtitle="A priced catalogue and recipe book for a field kitchen with limited equipment.">
        <StarterLibraryButton operationId={id} recipeCount={recipes.length} />
      </Card>

      <details className="rounded-md border border-tr-line bg-tr-charcoal p-4">
        <summary className="cursor-pointer font-semibold text-tr-white">Add a priced ingredient to the catalogue</summary>
        <p className="mt-1 text-sm text-tr-grey">
          Cost per unit prices the menu; pack size and pack cost drive the shopping list. Writing an
          ingredient list on a recipe creates missing ingredients for you — use this when you want the price in
          from the start.
        </p>
        <form action={createIngredient} className="mt-3 grid gap-3 sm:grid-cols-4">
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
      </details>
    </div>
  );
}
