/**
 * Parses a pasted ingredient list into structured lines.
 *
 * A Food Unit Leader inventing a dish should be able to type it the way they
 * would write it on a card — "60 g rolled oats" — rather than filling a form
 * per ingredient. Entering a ten-ingredient recipe through one-at-a-time
 * submits is the reason people keep using a notebook instead.
 *
 * Deliberately forgiving about format and strict about what it claims: a line
 * it cannot read is returned as unparsed rather than guessed at, because a
 * silently mis-read quantity becomes a wrong shopping order.
 */

/** Canonical units, with the spellings people actually type. */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g', gm: 'g', gs: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'L', lt: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L',
  each: 'each', ea: 'each', pc: 'each', pcs: 'each', piece: 'each', pieces: 'each',
  slice: 'slice', slices: 'slice',
  pair: 'pair', pairs: 'pair',
  tin: 'tin', tins: 'tin', can: 'tin', cans: 'tin',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup',
  loaf: 'each', loaves: 'each',
};

export interface ParsedIngredient {
  readonly name: string;
  readonly qty: number;
  readonly unit: string;
  /** The line as typed, so the UI can show what it understood against what was written. */
  readonly raw: string;
}

export interface ParseResult {
  readonly lines: readonly ParsedIngredient[];
  /** Lines that could not be read. Shown back rather than dropped. */
  readonly unparsed: readonly string[];
}

const FRACTIONS: Record<string, number> = {
  '1/4': 0.25, '1/3': 0.333, '1/2': 0.5, '2/3': 0.667, '3/4': 0.75,
  '¼': 0.25, '⅓': 0.333, '½': 0.5, '⅔': 0.667, '¾': 0.75,
};

function toNumber(token: string): number | null {
  if (token in FRACTIONS) return FRACTIONS[token] ?? null;
  // "1 1/2" arrives already split; handle "1.5" and "1,5".
  const cleaned = token.replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** One line, e.g. "60 g rolled oats", "2 eggs", "200ml milk", "salt". */
export function parseIngredientLine(raw: string): ParsedIngredient | null {
  const line = raw.replace(/^[\s*\-–—•·]+/, '').replace(/\s+/g, ' ').trim();
  if (line === '') return null;

  // Leading quantity, optionally with a fraction, optionally glued to its unit.
  const match = line.match(
    // A bare fraction is tried before a plain number, or "1/2" reads as "1".
    /^((?:\d+\/\d+)|(?:\d+(?:[.,]\d+)?)|(?:[¼⅓½⅔¾]))\s*(?:(\d+\/\d+|[¼⅓½⅔¾])\s*)?([a-zA-Z]+)?\.?\s*(.*)$/,
  );

  if (match === null) {
    // No quantity at all — "salt", "black pepper to taste".
    return { name: cleanName(line), qty: 1, unit: 'each', raw };
  }

  const [, whole, fraction, maybeUnit, rest] = match;
  let qty = toNumber(whole ?? '');
  if (qty === null) return null;
  if (fraction !== undefined) {
    const extra = toNumber(fraction);
    if (extra !== null) qty += extra;
  }

  let unit = 'each';
  let name = rest ?? '';

  if (maybeUnit !== undefined) {
    const canonical = UNIT_ALIASES[maybeUnit.toLowerCase()];
    if (canonical !== undefined) {
      unit = canonical;
    } else {
      // Not a unit — it was the first word of the name, e.g. "2 eggs".
      name = `${maybeUnit} ${name}`.trim();
    }
  }

  const cleaned = cleanName(name);
  if (cleaned === '') return null;
  return { name: cleaned, qty: Math.round((qty + Number.EPSILON) * 1000) / 1000, unit, raw };
}

/**
 * Vague measures people write instead of a number. Left in the name they would
 * create "pinch of salt" as a separate ingredient from the catalogue's "Salt",
 * and the shopping list would then order both.
 */
const VAGUE_MEASURES = /^(?:a\s+)?(?:pinch|handful|splash|dash|knob|drizzle|sprinkle|squeeze|glug|scoop|few)\s+(?:of\s+)?/i;

/**
 * Preparation notes that follow a comma. Only these are stripped: unknown
 * trailing text is kept, because dropping it could silently lose an ingredient.
 */
const PREP_NOTES = new Set([
  'chopped', 'finely chopped', 'roughly chopped', 'diced', 'finely diced', 'minced',
  'sliced', 'thinly sliced', 'grated', 'shredded', 'crushed', 'cubed', 'peeled',
  'drained', 'rinsed', 'drained and rinsed', 'melted', 'softened', 'beaten',
  'to taste', 'optional', 'or more to taste', 'plus extra', 'for frying', 'for serving',
]);

function cleanName(value: string): string {
  let name = value
    .replace(/^of\s+/i, '')
    .replace(/\s+/g, ' ')
    // Re-joining a first word that turned out not to be a unit can leave a gap
    // before punctuation, which would hide the preparation note that follows.
    .replace(/\s+([,;])/g, '$1')
    .trim();
  name = name.replace(VAGUE_MEASURES, '').trim();

  // "2 onions, finely chopped" is the same ingredient as "onions".
  const comma = name.indexOf(',');
  if (comma > 0) {
    const tail = name.slice(comma + 1).trim().toLowerCase().replace(/[.)]+$/, '');
    if (PREP_NOTES.has(tail)) name = name.slice(0, comma);
  }

  return name
    .replace(/\s*\((?:optional|to taste)\)\s*$/i, '')
    .replace(/[,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseIngredientList(text: string): ParseResult {
  const lines: ParsedIngredient[] = [];
  const unparsed: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const parsed = parseIngredientLine(raw);
    if (parsed === null) unparsed.push(raw.trim());
    else lines.push(parsed);
  }

  return { lines, unparsed };
}
