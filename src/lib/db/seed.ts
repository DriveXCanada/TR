/**
 * Loads the fictional sample deployment. Idempotent by operation name: running
 * it twice replaces the sample rather than duplicating it.
 *
 * Everything it writes is invented. See seed-data.ts.
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from './index';
import { hashPin } from '../auth/password';
import { daysBetween } from '../presence';
import { ICS_ROLES } from '../domain';
import {
  INGREDIENTS, RECIPES, ROSTER, SAMPLE_MENU, OP_START, OP_END, PER_PERSON_PER_DAY,
} from './seed-data';

const OP_NAME = 'OP MAPLE SHIELD — Sample';

export async function seed(): Promise<string> {
  const db = getDb();

  // Replace any previous sample. Cascades clear volunteers, menus and the rest.
  const existing = await db.select().from(schema.operations).where(eq(schema.operations.name, OP_NAME));
  for (const op of existing) {
    await db.delete(schema.operations).where(eq(schema.operations.id, op.id));
  }

  const kioskToken = randomToken();
  const inserted = await db.insert(schema.operations).values({
    name: OP_NAME,
    location: 'Riverbend Community Centre, Fictionville MB',
    startDate: OP_START,
    endDate: OP_END,
    perPersonPerDay: PER_PERSON_PER_DAY,
    currency: 'CAD',
    kioskToken,
    retentionDays: 30,
    status: 'active',
  }).returning();
  const op = inserted[0];
  if (op === undefined) throw new Error('Failed to create the sample operation.');

  // --- Ingredients ---
  const ingredientIds = new Map<string, string>();
  for (const item of INGREDIENTS) {
    const row = await db.insert(schema.ingredients).values({
      operationId: op.id,
      name: item.name,
      category: item.category,
      defaultUnit: item.defaultUnit,
      unitCost: item.unitCost,
      packSize: item.packSize ?? null,
      packUnit: item.packUnit ?? null,
      packCost: item.packCost ?? null,
      haveOnHand: item.haveOnHand ?? '0',
    }).returning();
    const id = row[0]?.id;
    if (id !== undefined) ingredientIds.set(item.key, id);
  }

  // --- Recipes ---
  const recipeIds = new Map<string, string>();
  for (const recipe of RECIPES) {
    const row = await db.insert(schema.recipes).values({
      operationId: op.id,
      name: recipe.name,
      category: recipe.category,
      tags: recipe.tags,
      method: recipe.method,
      burners: recipe.burners,
    }).returning();
    const id = row[0]?.id;
    if (id === undefined) continue;
    recipeIds.set(recipe.key, id);
    for (const item of recipe.items) {
      const ingredientId = ingredientIds.get(item.key);
      if (ingredientId === undefined) continue;
      await db.insert(schema.recipeIngredients).values({
        recipeId: id,
        ingredientId,
        qtyPerServing: String(item.qtyPerServing),
        unit: item.unit,
      });
    }
  }

  // --- Roster ---
  for (const person of ROSTER) {
    const row = await db.insert(schema.volunteers).values({
      operationId: op.id,
      firstName: person.first,
      lastName: person.last,
      icsRole: person.role,
      phone: `555-01${person.phoneTail}`,
      email: `${person.first.toLowerCase()}.${person.last.toLowerCase().replace(/[^a-z]/g, '')}@example.org`,
      onSite: true,
      arriveDate: person.arriveDate,
      arriveMeal: person.arriveMeal,
      departDate: person.departDate,
      departMeal: person.departMeal,
      epipenCarrying: person.epipen !== undefined,
      epipenLocation: person.epipen ?? null,
      likes: person.likes ?? [],
      dislikes: person.dislikes ?? [],
      morale: person.morale ?? [],
      source: 'kiosk',
      consentAt: new Date(),
    }).returning();
    const volunteerId = row[0]?.id;
    if (volunteerId === undefined) continue;
    for (const restriction of person.restrictions ?? []) {
      await db.insert(schema.restrictions).values({
        volunteerId,
        key: restriction.key,
        severity: restriction.severity,
        note: restriction.note ?? null,
      });
    }
  }

  // --- Menu ---
  for (const entry of SAMPLE_MENU) {
    const slotRow = await db.insert(schema.menuSlots).values({
      operationId: op.id,
      day: entry.day,
      slot: entry.slot as (typeof schema.menuSlots.$inferInsert)['slot'],
      servings: null,
    }).returning();
    const slotId = slotRow[0]?.id;
    if (slotId === undefined) continue;
    for (const key of entry.recipeKeys) {
      const recipeId = recipeIds.get(key);
      if (recipeId === undefined) continue;
      await db.insert(schema.menuSlotItems).values({ menuSlotId: slotId, recipeId, adHocName: null });
    }
  }

  // --- Resource demand: a rough target per role per day ---
  const targets: Partial<Record<(typeof ICS_ROLES)[number], number>> = {
    IC: 1, SO: 1, OSC: 1, PSC: 1, FSC: 1, LSC: 1, FUL: 1, PIO: 1,
    'Core Ops': 24, 'Site Survey': 3, AP: 4, JITT: 4,
  };
  for (const day of daysBetween(OP_START, OP_END)) {
    for (const role of ICS_ROLES) {
      const target = targets[role];
      if (target === undefined) continue;
      await db.insert(schema.resourceDemands).values({ operationId: op.id, icsRole: role, day, target });
    }
  }

  // --- Travel ---
  await db.insert(schema.travel).values([
    { operationId: op.id, direction: 'inbound', day: OP_START, fromLoc: 'Winnipeg YWG', toLoc: 'Fictionville', flight: 'XX 412', dep: '07:20', arr: '09:05', rental: 'Van A — 7 seats', notes: 'Advance party' },
    { operationId: op.id, direction: 'inbound', day: '2026-03-05', fromLoc: 'Winnipeg YWG', toLoc: 'Fictionville', flight: 'XX 418', dep: '11:40', arr: '13:25', rental: 'Van B — 12 seats', notes: 'JITT intake' },
    { operationId: op.id, direction: 'outbound', day: '2026-03-05', fromLoc: 'Fictionville', toLoc: 'Winnipeg YWG', flight: 'XX 419', dep: '15:10', arr: '16:55', rental: null, notes: 'Departs after lunch service' },
    { operationId: op.id, direction: 'outbound', day: OP_END, fromLoc: 'Fictionville', toLoc: 'Winnipeg YWG', flight: 'XX 430', dep: '18:00', arr: '19:45', rental: 'Van A return', notes: 'Demob' },
  ]);

  // --- Demo lead account ---
  const demoUser = 'ful';
  const demoPin = '2468';
  const demoName = 'Bronwen Castellanos (FUL)';
  const already = await db.select().from(schema.users).where(eq(schema.users.username, demoUser)).limit(1);
  let userId = already[0]?.id;
  if (userId === undefined) {
    const created = await db.insert(schema.users).values({
      username: demoUser, name: demoName, pinHash: await hashPin(demoPin), isMaster: false,
    }).returning();
    userId = created[0]?.id;
  } else {
    // Re-seeding must reset the demo account, not leave a stale name or PIN.
    await db.update(schema.users)
      .set({ name: demoName, pinHash: await hashPin(demoPin), isActive: true })
      .where(eq(schema.users.id, userId));
  }
  if (userId !== undefined) {
    await db.insert(schema.operationMembers)
      .values({ operationId: op.id, userId, role: 'lead' })
      .onConflictDoNothing();
  }

  return [
    `Seeded "${OP_NAME}"`,
    `  operation id : ${op.id}`,
    `  kiosk token  : ${kioskToken}`,
    `  demo login   : ${demoUser} / ${demoPin}`,
    `  roster       : ${ROSTER.length} volunteers (all fictional)`,
    `  recipes      : ${RECIPES.length}, ingredients: ${INGREDIENTS.length}`,
  ].join('\n');
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
