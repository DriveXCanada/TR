/**
 * Fictional sample deployment.
 *
 * EVERY person here is invented. Phone numbers use the 555-01xx reserved range
 * and emails use example.org, so nothing in this file can reach a real person.
 * Do not replace these with real volunteer records — see PRIVACY.md.
 */
import type { IcsRole, Meal, RecipeCategory, Severity } from '../domain';

export const OP_START = '2026-03-02';
export const OP_END = '2026-03-08';
export const PER_PERSON_PER_DAY = '25.00';

export interface SeedIngredient {
  key: string; name: string; category: string; defaultUnit: string;
  unitCost: string; packSize?: string; packUnit?: string; packCost?: string; haveOnHand?: string;
}

export const INGREDIENTS: readonly SeedIngredient[] = [
  // dry goods
  { key: 'oats', name: 'Rolled oats', category: 'dry goods', defaultUnit: 'g', unitCost: '0.0045', packSize: '1000', packUnit: 'g', packCost: '4.49' },
  { key: 'cereal', name: 'Cold cereal', category: 'dry goods', defaultUnit: 'g', unitCost: '0.0090', packSize: '750', packUnit: 'g', packCost: '6.79' },
  { key: 'flour', name: 'All-purpose flour', category: 'dry goods', defaultUnit: 'g', unitCost: '0.0028', packSize: '2500', packUnit: 'g', packCost: '6.99' },
  { key: 'sugar', name: 'Granulated sugar', category: 'dry goods', defaultUnit: 'g', unitCost: '0.0032', packSize: '2000', packUnit: 'g', packCost: '6.49' },
  { key: 'rice', name: 'Long grain rice', category: 'dry goods', defaultUnit: 'g', unitCost: '0.0035', packSize: '4000', packUnit: 'g', packCost: '13.99' },
  { key: 'pasta', name: 'Penne pasta', category: 'dry goods', defaultUnit: 'g', unitCost: '0.0040', packSize: '900', packUnit: 'g', packCost: '3.59' },
  // bakery
  { key: 'bread', name: 'Sliced bread', category: 'bakery', defaultUnit: 'slice', unitCost: '0.1100', packSize: '20', packUnit: 'slice', packCost: '2.19' },
  { key: 'tortilla', name: 'Flour tortillas', category: 'bakery', defaultUnit: 'each', unitCost: '0.3500', packSize: '10', packUnit: 'each', packCost: '3.49' },
  // dairy
  { key: 'milk', name: 'Milk 2%', category: 'dairy', defaultUnit: 'ml', unitCost: '0.0019', packSize: '4000', packUnit: 'ml', packCost: '7.49' },
  { key: 'butter', name: 'Butter', category: 'dairy', defaultUnit: 'g', unitCost: '0.0140', packSize: '454', packUnit: 'g', packCost: '6.29' },
  { key: 'cheddar', name: 'Cheddar cheese', category: 'dairy', defaultUnit: 'g', unitCost: '0.0180', packSize: '700', packUnit: 'g', packCost: '12.49' },
  { key: 'eggs', name: 'Eggs', category: 'dairy', defaultUnit: 'each', unitCost: '0.3400', packSize: '30', packUnit: 'each', packCost: '9.99' },
  // protein
  { key: 'bacon', name: 'Bacon', category: 'protein', defaultUnit: 'g', unitCost: '0.0210', packSize: '500', packUnit: 'g', packCost: '10.49' },
  { key: 'sausage', name: 'Breakfast sausage', category: 'protein', defaultUnit: 'g', unitCost: '0.0165', packSize: '500', packUnit: 'g', packCost: '8.29' },
  { key: 'coldcuts', name: 'Sliced deli turkey', category: 'protein', defaultUnit: 'g', unitCost: '0.0240', packSize: '400', packUnit: 'g', packCost: '9.59' },
  { key: 'groundbeef', name: 'Ground beef', category: 'protein', defaultUnit: 'g', unitCost: '0.0135', packSize: '1000', packUnit: 'g', packCost: '13.49' },
  { key: 'chicken', name: 'Chicken thighs', category: 'protein', defaultUnit: 'g', unitCost: '0.0110', packSize: '2000', packUnit: 'g', packCost: '21.99' },
  { key: 'beans', name: 'Kidney beans, tinned', category: 'protein', defaultUnit: 'g', unitCost: '0.0044', packSize: '540', packUnit: 'g', packCost: '2.39' },
  // produce
  { key: 'lettuce', name: 'Lettuce', category: 'produce', defaultUnit: 'g', unitCost: '0.0075', packSize: '500', packUnit: 'g', packCost: '3.49' },
  { key: 'tomato', name: 'Tomatoes', category: 'produce', defaultUnit: 'g', unitCost: '0.0060', packSize: '1000', packUnit: 'g', packCost: '5.99' },
  { key: 'onion', name: 'Onions', category: 'produce', defaultUnit: 'g', unitCost: '0.0030', packSize: '2000', packUnit: 'g', packCost: '5.49' },
  { key: 'carrot', name: 'Carrots', category: 'produce', defaultUnit: 'g', unitCost: '0.0028', packSize: '2000', packUnit: 'g', packCost: '4.99' },
  { key: 'potato', name: 'Potatoes', category: 'produce', defaultUnit: 'g', unitCost: '0.0022', packSize: '4500', packUnit: 'g', packCost: '8.99' },
  { key: 'apple', name: 'Apples', category: 'produce', defaultUnit: 'each', unitCost: '0.6500', packSize: '12', packUnit: 'each', packCost: '7.49' },
  { key: 'banana', name: 'Bananas', category: 'produce', defaultUnit: 'each', unitCost: '0.3800', packSize: '12', packUnit: 'each', packCost: '4.29' },
  // pantry
  { key: 'peanutbutter', name: 'Peanut butter', category: 'pantry', defaultUnit: 'g', unitCost: '0.0095', packSize: '1000', packUnit: 'g', packCost: '8.99' },
  { key: 'jam', name: 'Strawberry jam', category: 'pantry', defaultUnit: 'g', unitCost: '0.0088', packSize: '500', packUnit: 'g', packCost: '4.29' },
  { key: 'mayo', name: 'Mayonnaise', category: 'pantry', defaultUnit: 'g', unitCost: '0.0072', packSize: '890', packUnit: 'g', packCost: '6.29' },
  { key: 'worcestershire', name: 'Worcestershire sauce', category: 'pantry', defaultUnit: 'ml', unitCost: '0.0180', packSize: '284', packUnit: 'ml', packCost: '4.99' },
  { key: 'tomatopaste', name: 'Tomato paste', category: 'pantry', defaultUnit: 'g', unitCost: '0.0055', packSize: '369', packUnit: 'g', packCost: '1.99' },
  { key: 'oil', name: 'Vegetable oil', category: 'pantry', defaultUnit: 'ml', unitCost: '0.0040', packSize: '3000', packUnit: 'ml', packCost: '11.99', haveOnHand: '3000' },
  { key: 'salt', name: 'Salt', category: 'pantry', defaultUnit: 'g', unitCost: '0.0015', haveOnHand: '2000' },
  { key: 'pepper', name: 'Black pepper', category: 'pantry', defaultUnit: 'g', unitCost: '0.0250', haveOnHand: '400' },
  { key: 'chilipowder', name: 'Chili powder', category: 'pantry', defaultUnit: 'g', unitCost: '0.0300', packSize: '100', packUnit: 'g', packCost: '3.29' },
  { key: 'syrup', name: 'Maple syrup', category: 'pantry', defaultUnit: 'ml', unitCost: '0.0240', packSize: '500', packUnit: 'ml', packCost: '11.99' },
  // drinks
  { key: 'coffee', name: 'Ground coffee', category: 'drinks', defaultUnit: 'g', unitCost: '0.0230', packSize: '900', packUnit: 'g', packCost: '20.49' },
  { key: 'tea', name: 'Tea bags', category: 'drinks', defaultUnit: 'each', unitCost: '0.0700', packSize: '100', packUnit: 'each', packCost: '6.99' },
  { key: 'juice', name: 'Orange juice', category: 'drinks', defaultUnit: 'ml', unitCost: '0.0026', packSize: '1750', packUnit: 'ml', packCost: '4.49' },
  { key: 'water', name: 'Bottled water', category: 'drinks', defaultUnit: 'each', unitCost: '0.3300', packSize: '24', packUnit: 'each', packCost: '7.99' },
  // snacks
  { key: 'granolabar', name: 'Granola bars', category: 'snacks', defaultUnit: 'each', unitCost: '0.5500', packSize: '24', packUnit: 'each', packCost: '12.99' },
  { key: 'trailmix', name: 'Trail mix', category: 'snacks', defaultUnit: 'g', unitCost: '0.0160', packSize: '900', packUnit: 'g', packCost: '13.99' },
];

export interface SeedRecipe {
  key: string; name: string; category: RecipeCategory; tags: string[];
  burners: number; method: string;
  items: { key: string; qtyPerServing: number; unit: string }[];
}

export const RECIPES: readonly SeedRecipe[] = [
  // --- Breakfast ---
  { key: 'oatmeal', name: 'Oatmeal', category: 'main', tags: ['gluten', 'dairy', 'vegetarian'], burners: 1,
    method: 'Bring milk and water to a simmer, stir in oats, cook 5 minutes. Serve with syrup.',
    items: [ { key: 'oats', qtyPerServing: 60, unit: 'g' }, { key: 'milk', qtyPerServing: 200, unit: 'ml' }, { key: 'syrup', qtyPerServing: 15, unit: 'ml' }, { key: 'salt', qtyPerServing: 1, unit: 'g' } ] },
  { key: 'bacon-eggs', name: 'Bacon & eggs', category: 'main', tags: ['egg', 'pork'], burners: 2,
    method: 'Sheet-pan the bacon at 200C for 18 minutes. Scramble eggs in batches.',
    items: [ { key: 'bacon', qtyPerServing: 60, unit: 'g' }, { key: 'eggs', qtyPerServing: 2, unit: 'each' }, { key: 'butter', qtyPerServing: 8, unit: 'g' }, { key: 'pepper', qtyPerServing: 0.5, unit: 'g' } ] },
  { key: 'sausage-eggs', name: 'Sausage & eggs', category: 'main', tags: ['egg', 'pork'], burners: 2,
    method: 'Sheet-pan the sausages at 200C for 25 minutes. Scramble eggs in batches.',
    items: [ { key: 'sausage', qtyPerServing: 90, unit: 'g' }, { key: 'eggs', qtyPerServing: 2, unit: 'each' }, { key: 'butter', qtyPerServing: 8, unit: 'g' } ] },
  { key: 'cold-cereal', name: 'Cold cereal', category: 'main', tags: ['gluten', 'dairy', 'vegetarian'], burners: 0,
    method: 'No cooking. Set out cereal, milk and bananas.',
    items: [ { key: 'cereal', qtyPerServing: 55, unit: 'g' }, { key: 'milk', qtyPerServing: 180, unit: 'ml' }, { key: 'banana', qtyPerServing: 0.5, unit: 'each' } ] },
  { key: 'pancakes', name: 'Pancakes', category: 'main', tags: ['gluten', 'dairy', 'egg', 'vegetarian'], burners: 2,
    method: 'Batter of flour, milk, egg. Griddle in batches. Hold warm in the oven.',
    items: [ { key: 'flour', qtyPerServing: 70, unit: 'g' }, { key: 'milk', qtyPerServing: 120, unit: 'ml' }, { key: 'eggs', qtyPerServing: 0.5, unit: 'each' }, { key: 'sugar', qtyPerServing: 10, unit: 'g' }, { key: 'butter', qtyPerServing: 10, unit: 'g' }, { key: 'syrup', qtyPerServing: 20, unit: 'ml' } ] },

  // --- Packed field lunches (cold, no hot service) ---
  { key: 'pack-coldcuts', name: 'Cold cut sandwich', category: 'main', tags: ['pack', 'gluten', 'egg'], burners: 0,
    method: 'Assemble cold. Turkey, lettuce, tomato, mayo. Wrap and box.',
    items: [ { key: 'bread', qtyPerServing: 2, unit: 'slice' }, { key: 'coldcuts', qtyPerServing: 70, unit: 'g' }, { key: 'lettuce', qtyPerServing: 20, unit: 'g' }, { key: 'tomato', qtyPerServing: 30, unit: 'g' }, { key: 'mayo', qtyPerServing: 12, unit: 'g' } ] },
  { key: 'pack-blt', name: 'BLT sandwich', category: 'main', tags: ['pack', 'gluten', 'egg', 'pork'], burners: 1,
    method: 'Cook bacon ahead with breakfast. Assemble cold after breakfast service.',
    items: [ { key: 'bread', qtyPerServing: 2, unit: 'slice' }, { key: 'bacon', qtyPerServing: 45, unit: 'g' }, { key: 'lettuce', qtyPerServing: 20, unit: 'g' }, { key: 'tomato', qtyPerServing: 35, unit: 'g' }, { key: 'mayo', qtyPerServing: 12, unit: 'g' } ] },
  { key: 'pack-pbj', name: 'PB&J sandwich', category: 'main', tags: ['pack', 'peanuts', 'gluten', 'vegetarian'], burners: 0,
    method: 'Assemble cold. NOTE: peanut butter — keep the prep board separate from the other packs.',
    items: [ { key: 'bread', qtyPerServing: 2, unit: 'slice' }, { key: 'peanutbutter', qtyPerServing: 35, unit: 'g' }, { key: 'jam', qtyPerServing: 25, unit: 'g' } ] },
  { key: 'pack-cheese', name: 'Cheese sandwich', category: 'main', tags: ['pack', 'gluten', 'dairy', 'vegetarian'], burners: 0,
    method: 'Assemble cold. Cheddar, lettuce, butter.',
    items: [ { key: 'bread', qtyPerServing: 2, unit: 'slice' }, { key: 'cheddar', qtyPerServing: 55, unit: 'g' }, { key: 'butter', qtyPerServing: 8, unit: 'g' }, { key: 'lettuce', qtyPerServing: 20, unit: 'g' } ] },

  // --- Suppers ---
  { key: 'chilli', name: 'Beef chilli', category: 'main', tags: ['meat'], burners: 2,
    method: 'Brown beef with onion, add beans, tomato paste, chili powder and worcestershire. Simmer 40 minutes.',
    items: [ { key: 'groundbeef', qtyPerServing: 120, unit: 'g' }, { key: 'beans', qtyPerServing: 90, unit: 'g' }, { key: 'onion', qtyPerServing: 50, unit: 'g' }, { key: 'tomatopaste', qtyPerServing: 30, unit: 'g' }, { key: 'chilipowder', qtyPerServing: 3, unit: 'g' }, { key: 'worcestershire', qtyPerServing: 4, unit: 'ml' }, { key: 'rice', qtyPerServing: 80, unit: 'g' } ] },
  { key: 'chicken-rice', name: 'Roast chicken & rice', category: 'main', tags: ['poultry'], burners: 1,
    method: 'Sheet-pan chicken thighs at 200C for 35 minutes. Rice on the one burner.',
    items: [ { key: 'chicken', qtyPerServing: 180, unit: 'g' }, { key: 'rice', qtyPerServing: 90, unit: 'g' }, { key: 'carrot', qtyPerServing: 80, unit: 'g' }, { key: 'oil', qtyPerServing: 8, unit: 'ml' }, { key: 'salt', qtyPerServing: 2, unit: 'g' } ] },
  { key: 'pasta-bake', name: 'Tomato pasta bake', category: 'main', tags: ['gluten', 'dairy', 'vegetarian'], burners: 1,
    method: 'Boil pasta, fold through tomato and cheese, bake 20 minutes.',
    items: [ { key: 'pasta', qtyPerServing: 110, unit: 'g' }, { key: 'tomatopaste', qtyPerServing: 40, unit: 'g' }, { key: 'cheddar', qtyPerServing: 40, unit: 'g' }, { key: 'onion', qtyPerServing: 40, unit: 'g' }, { key: 'oil', qtyPerServing: 6, unit: 'ml' } ] },
  { key: 'roast-veg', name: 'Roast potatoes & carrots', category: 'side', tags: ['vegetarian', 'vegan'], burners: 0,
    method: 'Sheet-pan at 200C for 40 minutes. No burner needed.',
    items: [ { key: 'potato', qtyPerServing: 200, unit: 'g' }, { key: 'carrot', qtyPerServing: 70, unit: 'g' }, { key: 'oil', qtyPerServing: 10, unit: 'ml' }, { key: 'salt', qtyPerServing: 2, unit: 'g' } ] },

  // --- Snacks & drinks ---
  { key: 'snack-fruit', name: 'Fruit bowl', category: 'snack', tags: ['vegetarian', 'vegan'], burners: 0,
    method: 'Set out whole fruit.', items: [ { key: 'apple', qtyPerServing: 1, unit: 'each' }, { key: 'banana', qtyPerServing: 0.5, unit: 'each' } ] },
  { key: 'snack-granola', name: 'Granola bars', category: 'snack', tags: ['gluten'], burners: 0,
    method: 'Box on the table.', items: [ { key: 'granolabar', qtyPerServing: 1, unit: 'each' } ] },
  { key: 'snack-trailmix', name: 'Trail mix', category: 'snack', tags: ['tree-nuts', 'peanuts'], burners: 0,
    method: 'Portion into cups. NOTE: contains nuts — label the table.',
    items: [ { key: 'trailmix', qtyPerServing: 45, unit: 'g' } ] },
  { key: 'drink-coffee', name: 'Coffee', category: 'drink', tags: ['vegan'], burners: 0,
    method: 'Urn, refreshed every two hours.', items: [ { key: 'coffee', qtyPerServing: 14, unit: 'g' } ] },
  { key: 'drink-tea', name: 'Tea', category: 'drink', tags: ['vegan'], burners: 0,
    method: 'Hot water urn and a box of bags.', items: [ { key: 'tea', qtyPerServing: 1, unit: 'each' } ] },
  { key: 'drink-juice', name: 'Orange juice', category: 'drink', tags: ['vegan', 'high-sugar'], burners: 0,
    method: 'Jugs at breakfast.', items: [ { key: 'juice', qtyPerServing: 200, unit: 'ml' } ] },
  { key: 'drink-water', name: 'Bottled water', category: 'drink', tags: ['vegan'], burners: 0,
    method: 'Cases at every exit. Two per person per day minimum.',
    items: [ { key: 'water', qtyPerServing: 2, unit: 'each' } ] },
];

export interface SeedVolunteer {
  first: string; last: string; role: IcsRole; phoneTail: string;
  arriveDate: string; arriveMeal: Meal;
  departDate: string | null; departMeal: Meal | null;
  epipen?: string;
  restrictions?: { key: string; severity: Severity; note?: string }[];
  likes?: string[]; dislikes?: string[]; morale?: string[];
}

/** ~50 invented Greyshirts with staggered, meal-level arrivals and departures. */
export const ROSTER: readonly SeedVolunteer[] = [
  { first: 'Marisol', last: 'Trebek', role: 'IC', phoneTail: '01', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', likes: ['coffee'], morale: ['chilli'] },
  { first: 'Devon', last: 'Achterberg', role: 'SO', phoneTail: '02', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'fish', severity: 'severe', note: 'Anaphylaxis. Carries two auto-injectors.' }], epipen: 'Right thigh pocket; spare in the cache box, kitchen shelf 2' },
  // THE spec case: severe allergy, leaves after LUNCH — must drop from supper.
  { first: 'Priya', last: 'Ondaatje-Bell', role: 'FUL', phoneTail: '03', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-05', departMeal: 'lunch',
    restrictions: [{ key: 'peanuts', severity: 'severe', note: 'Anaphylaxis. No shared utensils with PB&J prep.' }], epipen: 'Belt pouch; spare taped inside the kitchen first-aid box',
    likes: ['pasta'], dislikes: ['chilli'] },
  { first: 'Callum', last: 'Ferreira', role: 'OSC', phoneTail: '04', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-07', departMeal: 'supper',
    restrictions: [{ key: 'tree-nuts', severity: 'severe', note: 'Anaphylaxis — all tree nuts.' }], epipen: 'Cargo pocket, left leg' },
  { first: 'Nkechi', last: 'Vandeveld', role: 'PSC', phoneTail: '05', arriveDate: '2026-03-02', arriveMeal: 'lunch', departDate: '2026-03-08', departMeal: 'breakfast',
    restrictions: [{ key: 'shellfish', severity: 'severe' }], epipen: 'Daypack front pocket' },
  { first: 'Bertram', last: 'Quillfeather', role: 'LSC', phoneTail: '06', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', likes: ['bacon'] },
  { first: 'Saoirse', last: 'Mbeki-Lindqvist', role: 'FSC', phoneTail: '07', arriveDate: '2026-03-03', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'lunch',
    restrictions: [{ key: 'gluten', severity: 'intolerance', note: 'Coeliac — cross-contamination matters.' }] },
  { first: 'Teodoro', last: 'Wickramasinghe', role: 'PIO', phoneTail: '08', arriveDate: '2026-03-02', arriveMeal: 'supper', departDate: '2026-03-06', departMeal: 'supper',
    restrictions: [{ key: 'vegetarian', severity: 'preference' }] },
  { first: 'Halima', last: 'Osterhout', role: 'Core Ops', phoneTail: '09', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'halal', severity: 'preference' }, { key: 'pork', severity: 'severe', note: 'Religious observance — treat as absolute.' }] },
  { first: 'Rasmus', last: 'Kettleborough', role: 'Core Ops', phoneTail: '10', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-05', departMeal: 'supper',
    restrictions: [{ key: 'dairy', severity: 'intolerance' }], dislikes: ['oatmeal'] },
  { first: 'Yolanda', last: 'Przybylski', role: 'Core Ops', phoneTail: '11', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', morale: ['pancakes'] },
  { first: 'Emeka', last: 'Thornbury', role: 'Core Ops', phoneTail: '12', arriveDate: '2026-03-03', arriveMeal: 'lunch', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'diabetic', severity: 'intolerance', note: 'Type 1. Needs a low-sugar option at every service.' }] },
  { first: 'Ingrid', last: 'Calloway-Nasser', role: 'Core Ops', phoneTail: '13', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-06', departMeal: 'lunch' },
  { first: 'Obadiah', last: 'Fenwick', role: 'Core Ops', phoneTail: '14', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', likes: ['chilli'] },
  { first: 'Xiomara', last: 'Delacroix-Huang', role: 'Core Ops', phoneTail: '15', arriveDate: '2026-03-04', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'egg', severity: 'intolerance' }] },
  { first: 'Fitzgerald', last: 'Mbatha', role: 'Core Ops', phoneTail: '16', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-07', departMeal: 'lunch' },
  { first: 'Anneliese', last: 'Vukovic', role: 'Core Ops', phoneTail: '17', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'vegetarian', severity: 'preference' }], likes: ['pasta'] },
  { first: 'Cormac', last: 'Adeyemi-Blackwood', role: 'Core Ops', phoneTail: '18', arriveDate: '2026-03-03', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Persephone', last: 'Larkspur', role: 'Core Ops', phoneTail: '19', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-05', departMeal: 'breakfast' },
  { first: 'Jarrah', last: 'Okonjo-Steinmetz', role: 'Core Ops', phoneTail: '20', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', morale: ['bacon'] },
  { first: 'Lucinda', last: 'Hargreaves', role: 'Site Survey', phoneTail: '21', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-04', departMeal: 'supper' },
  { first: 'Ptolemy', last: 'Ravensworth', role: 'Site Survey', phoneTail: '22', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-04', departMeal: 'supper',
    restrictions: [{ key: 'soy', severity: 'intolerance' }] },
  { first: 'Beatriz', last: 'Nakagawa-Oyelaran', role: 'Site Survey', phoneTail: '23', arriveDate: '2026-03-03', arriveMeal: 'breakfast', departDate: '2026-03-06', departMeal: 'supper' },
  { first: 'Silas', last: 'Grimsdottir', role: 'AP', phoneTail: '24', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Magdalena', last: 'Ossowski', role: 'AP', phoneTail: '25', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'vegan', severity: 'preference' }] },
  { first: 'Ignatius', last: 'Fairweather', role: 'AP', phoneTail: '26', arriveDate: '2026-03-04', arriveMeal: 'lunch', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Rosalind', last: 'Ekwueme', role: 'AP', phoneTail: '27', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-07', departMeal: 'supper' },
  { first: 'Barnaby', last: 'Threlfall', role: 'JITT', phoneTail: '28', arriveDate: '2026-03-05', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Clementine', last: 'Abernathy-Rao', role: 'JITT', phoneTail: '29', arriveDate: '2026-03-05', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'gluten', severity: 'intolerance' }] },
  { first: 'Horatio', last: 'Nwachukwu', role: 'JITT', phoneTail: '30', arriveDate: '2026-03-05', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Wilhelmina', last: 'Bergström-Cruz', role: 'JITT', phoneTail: '31', arriveDate: '2026-03-05', arriveMeal: 'lunch', departDate: null, departMeal: null },
  { first: 'Alastair', last: 'Quimby', role: 'Core Ops', phoneTail: '32', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Tallulah', last: 'Onwuachi', role: 'Core Ops', phoneTail: '33', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-06', departMeal: 'supper', dislikes: ['fish'] },
  { first: 'Ezekiel', last: 'Vandermolen', role: 'Core Ops', phoneTail: '34', arriveDate: '2026-03-03', arriveMeal: 'supper', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Ottoline', last: 'Kasprzak', role: 'Core Ops', phoneTail: '35', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'sesame', severity: 'severe' }], epipen: 'Jacket chest pocket' },
  { first: 'Peregrine', last: 'Ashworth-Diallo', role: 'Core Ops', phoneTail: '36', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-07', departMeal: 'supper' },
  { first: 'Seraphina', last: 'Muldoon', role: 'Core Ops', phoneTail: '37', arriveDate: '2026-03-04', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', morale: ['coffee'] },
  { first: 'Thaddeus', last: 'Ngcobo', role: 'Core Ops', phoneTail: '38', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Verity', last: 'Lindqvist-Amara', role: 'Core Ops', phoneTail: '39', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-05', departMeal: 'supper' },
  { first: 'Octavian', last: 'Brightwater', role: 'Core Ops', phoneTail: '40', arriveDate: '2026-03-06', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Perpetua', last: 'Salvatierra', role: 'Core Ops', phoneTail: '41', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper', likes: ['rice'] },
  { first: 'Lysander', last: 'Okafor-Whitlock', role: 'Core Ops', phoneTail: '42', arriveDate: '2026-03-03', arriveMeal: 'breakfast', departDate: '2026-03-07', departMeal: 'lunch' },
  { first: 'Isadora', last: 'Penhaligon', role: 'Core Ops', phoneTail: '43', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper',
    restrictions: [{ key: 'mustard', severity: 'intolerance' }] },
  { first: 'Bartholomew', last: 'Ssempala', role: 'Core Ops', phoneTail: '44', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Griselda', last: 'Nightingale-Bosch', role: 'Core Ops', phoneTail: '45', arriveDate: '2026-03-04', arriveMeal: 'supper', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Marcellus', last: 'Adebayo', role: 'Core Ops', phoneTail: '46', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-06', departMeal: 'breakfast' },
  { first: 'Evangeline', last: 'Trzaskowski', role: 'Core Ops', phoneTail: '47', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Cassius', last: 'Mwangi-Foulkes', role: 'Core Ops', phoneTail: '48', arriveDate: '2026-03-05', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
  { first: 'Rowena', last: 'Blackthorne', role: 'Core Ops', phoneTail: '49', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-07', departMeal: 'supper', dislikes: ['oatmeal'] },
  { first: 'Fennimore', last: 'Achebe-Lindgren', role: 'Core Ops', phoneTail: '50', arriveDate: '2026-03-02', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' },
];

/** Three-day sample menu. Lunch is packed only. */
export const SAMPLE_MENU: readonly { day: string; slot: string; recipeKeys: string[] }[] = [
  { day: '2026-03-02', slot: 'breakfast', recipeKeys: ['oatmeal', 'cold-cereal'] },
  { day: '2026-03-02', slot: 'lunch', recipeKeys: ['pack-coldcuts', 'pack-cheese', 'pack-pbj'] },
  { day: '2026-03-02', slot: 'supper', recipeKeys: ['chilli', 'roast-veg'] },
  { day: '2026-03-02', slot: 'snack', recipeKeys: ['snack-fruit', 'snack-granola'] },
  { day: '2026-03-02', slot: 'drinks', recipeKeys: ['drink-coffee', 'drink-tea', 'drink-water'] },

  { day: '2026-03-03', slot: 'breakfast', recipeKeys: ['bacon-eggs'] },
  { day: '2026-03-03', slot: 'lunch', recipeKeys: ['pack-blt', 'pack-cheese'] },
  { day: '2026-03-03', slot: 'supper', recipeKeys: ['chicken-rice'] },
  { day: '2026-03-03', slot: 'snack', recipeKeys: ['snack-fruit'] },
  { day: '2026-03-03', slot: 'drinks', recipeKeys: ['drink-coffee', 'drink-juice', 'drink-water'] },

  { day: '2026-03-04', slot: 'breakfast', recipeKeys: ['pancakes', 'sausage-eggs'] },
  { day: '2026-03-04', slot: 'lunch', recipeKeys: ['pack-coldcuts', 'pack-pbj'] },
  { day: '2026-03-04', slot: 'supper', recipeKeys: ['pasta-bake', 'roast-veg'] },
  { day: '2026-03-04', slot: 'snack', recipeKeys: ['snack-granola'] },
  { day: '2026-03-04', slot: 'drinks', recipeKeys: ['drink-coffee', 'drink-tea', 'drink-water'] },
];
