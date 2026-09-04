/**
 * Operation data access.
 *
 * Access control lives here, not in the pages: restriction data is health data
 * about identifiable people and is readable only by members of that operation
 * (or the master account). Every loader goes through `requireOpAccess`.
 */
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb, schema } from '@/lib/db';
import type { SessionPayload } from '@/lib/auth/session';
import type { IcsRole, Meal, RecipeCategory, Severity, Slot } from '@/lib/domain';
import type { Stay } from '@/lib/presence';
import { sanitizeSizes, isSizeScheme, type SizeMap } from '@/lib/sizes';
import { ISSUE_POLICIES, KIT_CATEGORIES, type KitItem } from '@/lib/kit';

export interface VolunteerView extends Stay {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly icsRole: IcsRole;
  readonly phone: string | null;
  readonly email: string | null;
  readonly onSite: boolean;
  readonly epipenCarrying: boolean;
  readonly epipenLocation: string | null;
  readonly likes: readonly string[];
  readonly dislikes: readonly string[];
  readonly morale: readonly string[];
  readonly freeNote: string | null;
  readonly sizes: SizeMap;
  readonly restrictions: readonly { key: string; severity: Severity; note: string | null }[];
}

export interface RecipeView {
  readonly id: string;
  readonly name: string;
  readonly category: RecipeCategory;
  readonly tags: readonly string[];
  readonly method: string | null;
  readonly burners: number;
  readonly ingredients: readonly { ingredientId: string; name: string; qtyPerServing: number; unit: string }[];
}

export interface IngredientView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly defaultUnit: string;
  readonly unitCost: number;
  readonly packSize: number | null;
  readonly packUnit: string | null;
  readonly packCost: number | null;
  readonly haveOnHand: number;
}

export interface MenuSlotView {
  readonly id: string;
  readonly day: string;
  readonly slot: Slot;
  readonly servings: number | null;
  readonly items: readonly { id: string; recipeId: string | null; adHocName: string | null }[];
}

export interface OperationView {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly mealSchedule: readonly Meal[];
  readonly perPersonPerDay: number;
  readonly currency: string;
  readonly kioskToken: string;
  readonly retentionDays: number;
  readonly purgeAfter: string | null;
  readonly status: string;
  /** ICS roles excluded from kit counting. Never consulted for food. */
  readonly kitExemptRoles: readonly string[];
}

export interface OperationSnapshot {
  readonly kit: readonly KitItem[];
  readonly operation: OperationView;
  readonly volunteers: readonly VolunteerView[];
  readonly recipes: readonly RecipeView[];
  readonly ingredients: readonly IngredientView[];
  readonly menu: readonly MenuSlotView[];
  readonly demands: readonly { icsRole: IcsRole; day: string; target: number }[];
  readonly travel: readonly {
    id: string; direction: 'inbound' | 'outbound'; day: string;
    fromLoc: string | null; toLoc: string | null; flight: string | null;
    dep: string | null; arr: string | null; rental: string | null; notes: string | null;
  }[];
}

function num(value: string | null, fallback = 0): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Throws a 404 (not a 403) when the user is not a member — an outsider should
 * not learn that an operation exists.
 */
export async function requireOpAccess(operationId: string, session: SessionPayload): Promise<OperationView> {
  const db = getDb();
  const rows = await db.select().from(schema.operations).where(eq(schema.operations.id, operationId)).limit(1);
  const op = rows[0];
  if (op === undefined) notFound();

  if (!session.isMaster) {
    const membership = await db.select().from(schema.operationMembers).where(and(
      eq(schema.operationMembers.operationId, operationId),
      eq(schema.operationMembers.userId, session.userId),
    )).limit(1);
    if (membership.length === 0) notFound();
  }

  return {
    id: op.id,
    name: op.name,
    location: op.location,
    startDate: op.startDate,
    endDate: op.endDate,
    mealSchedule: op.mealSchedule,
    perPersonPerDay: num(op.perPersonPerDay, 0),
    currency: op.currency,
    kioskToken: op.kioskToken,
    retentionDays: op.retentionDays,
    purgeAfter: op.purgeAfter,
    status: op.status,
    kitExemptRoles: op.kitExemptRoles,
  };
}

export async function loadSnapshot(operationId: string, session: SessionPayload): Promise<OperationSnapshot> {
  const operation = await requireOpAccess(operationId, session);
  const db = getDb();

  const [volunteerRows, restrictionRows, recipeRows, recipeIngredientRows, ingredientRows, menuRows, itemRows, demandRows, travelRows, kitRows] =
    await Promise.all([
      db.select().from(schema.volunteers).where(eq(schema.volunteers.operationId, operationId)),
      db.select().from(schema.restrictions),
      db.select().from(schema.recipes).where(eq(schema.recipes.operationId, operationId)),
      db.select().from(schema.recipeIngredients),
      db.select().from(schema.ingredients).where(eq(schema.ingredients.operationId, operationId)),
      db.select().from(schema.menuSlots).where(eq(schema.menuSlots.operationId, operationId)),
      db.select().from(schema.menuSlotItems),
      db.select().from(schema.resourceDemands).where(eq(schema.resourceDemands.operationId, operationId)),
      db.select().from(schema.travel).where(eq(schema.travel.operationId, operationId)),
      db.select().from(schema.kitItems).where(eq(schema.kitItems.operationId, operationId)),
    ]);

  const volunteerIds = new Set(volunteerRows.map((v) => v.id));
  const restrictionsByVolunteer = new Map<string, { key: string; severity: Severity; note: string | null }[]>();
  for (const r of restrictionRows) {
    if (!volunteerIds.has(r.volunteerId)) continue;
    const list = restrictionsByVolunteer.get(r.volunteerId) ?? [];
    list.push({ key: r.key, severity: r.severity, note: r.note });
    restrictionsByVolunteer.set(r.volunteerId, list);
  }

  const ingredientNameById = new Map(ingredientRows.map((i) => [i.id, i.name]));
  const recipeIds = new Set(recipeRows.map((r) => r.id));
  const ingredientsByRecipe = new Map<string, RecipeView['ingredients'][number][]>();
  for (const ri of recipeIngredientRows) {
    if (!recipeIds.has(ri.recipeId)) continue;
    const list = ingredientsByRecipe.get(ri.recipeId) ?? [];
    list.push({
      ingredientId: ri.ingredientId,
      name: ingredientNameById.get(ri.ingredientId) ?? 'Unknown ingredient',
      qtyPerServing: num(ri.qtyPerServing),
      unit: ri.unit,
    });
    ingredientsByRecipe.set(ri.recipeId, list);
  }

  const menuIds = new Set(menuRows.map((m) => m.id));
  const itemsBySlot = new Map<string, MenuSlotView['items'][number][]>();
  for (const item of itemRows) {
    if (!menuIds.has(item.menuSlotId)) continue;
    const list = itemsBySlot.get(item.menuSlotId) ?? [];
    list.push({ id: item.id, recipeId: item.recipeId, adHocName: item.adHocName });
    itemsBySlot.set(item.menuSlotId, list);
  }

  const kit: KitItem[] = kitRows.map((k) => ({
    id: k.id,
    name: k.name,
    // Values are widened from text columns, so validate rather than assume.
    category: (KIT_CATEGORIES as readonly string[]).includes(k.category)
      ? (k.category as KitItem['category']) : 'other',
    issuePolicy: (ISSUE_POLICIES as readonly string[]).includes(k.issuePolicy)
      ? (k.issuePolicy as KitItem['issuePolicy']) : 'single_use',
    intervalDays: k.intervalDays,
    qtyPerPerson: num(k.qtyPerPerson, 1),
    unit: k.unit,
    sizeScheme: k.sizeScheme !== null && isSizeScheme(k.sizeScheme) ? k.sizeScheme : null,
    stockOnHand: num(k.stockOnHand),
    reorderLevel: num(k.reorderLevel),
    leadTimeDays: k.leadTimeDays,
  })).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  return {
    operation,
    kit,
    volunteers: volunteerRows.map((v) => ({
      id: v.id,
      firstName: v.firstName,
      lastName: v.lastName,
      icsRole: v.icsRole,
      phone: v.phone,
      email: v.email,
      onSite: v.onSite,
      arriveDate: v.arriveDate,
      arriveMeal: v.arriveMeal,
      departDate: v.departDate,
      departMeal: v.departMeal,
      epipenCarrying: v.epipenCarrying,
      epipenLocation: v.epipenLocation,
      likes: v.likes,
      dislikes: v.dislikes,
      morale: v.morale,
      freeNote: v.freeNote,
      sizes: sanitizeSizes(v.sizes),
      restrictions: restrictionsByVolunteer.get(v.id) ?? [],
    })).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    recipes: recipeRows.map((r) => ({
      id: r.id, name: r.name, category: r.category, tags: r.tags,
      method: r.method, burners: r.burners,
      ingredients: ingredientsByRecipe.get(r.id) ?? [],
    })).sort((a, b) => a.name.localeCompare(b.name)),
    ingredients: ingredientRows.map((i) => ({
      id: i.id, name: i.name, category: i.category, defaultUnit: i.defaultUnit,
      unitCost: num(i.unitCost), packSize: i.packSize === null ? null : num(i.packSize),
      packUnit: i.packUnit, packCost: i.packCost === null ? null : num(i.packCost),
      haveOnHand: num(i.haveOnHand),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    menu: menuRows.map((m) => ({
      id: m.id, day: m.day, slot: m.slot, servings: m.servings,
      items: itemsBySlot.get(m.id) ?? [],
    })),
    demands: demandRows.map((d) => ({ icsRole: d.icsRole, day: d.day, target: d.target })),
    travel: travelRows.map((t) => ({
      id: t.id, direction: t.direction, day: t.day, fromLoc: t.fromLoc, toLoc: t.toLoc,
      flight: t.flight, dep: t.dep, arr: t.arr, rental: t.rental, notes: t.notes,
    })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

/** Operations this user may see. */
export async function listOperations(session: SessionPayload): Promise<OperationView[]> {
  const db = getDb();
  const ops = await db.select().from(schema.operations);
  if (session.isMaster) return ops.map(toView);
  const memberships = await db.select().from(schema.operationMembers)
    .where(eq(schema.operationMembers.userId, session.userId));
  const allowed = new Set(memberships.map((m) => m.operationId));
  return ops.filter((o) => allowed.has(o.id)).map(toView);
}

function toView(op: typeof schema.operations.$inferSelect): OperationView {
  return {
    id: op.id, name: op.name, location: op.location, startDate: op.startDate, endDate: op.endDate,
    mealSchedule: op.mealSchedule, perPersonPerDay: num(op.perPersonPerDay), currency: op.currency,
    kioskToken: op.kioskToken, retentionDays: op.retentionDays, purgeAfter: op.purgeAfter, status: op.status,
    kitExemptRoles: op.kitExemptRoles,
  };
}
