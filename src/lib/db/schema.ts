/**
 * Drizzle schema.
 *
 * Health data on identifiable people lives in `volunteers` and `restrictions`.
 * Both cascade-delete from `operations` so the retention purge is a single
 * delete rather than a hand-maintained list of tables.
 */
import {
  boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type {
  IcsRole, Meal, RecipeCategory, Severity, Slot, TravelDirection, OperationStatus,
} from '../domain';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull(),
  name: text('name').notNull(),
  pinHash: text('pin_hash').notNull(),
  isMaster: boolean('is_master').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ usernameIdx: uniqueIndex('users_username_idx').on(t.username) }));

export const operations = pgTable('operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  mealSchedule: jsonb('meal_schedule').$type<Meal[]>().notNull().default(['breakfast', 'lunch', 'supper']),
  perPersonPerDay: numeric('per_person_per_day', { precision: 10, scale: 2 }).notNull().default('25.00'),
  currency: text('currency').notNull().default('CAD'),
  kioskToken: text('kiosk_token').notNull(),
  retentionDays: integer('retention_days').notNull().default(30),
  purgeAfter: date('purge_after'),
  status: text('status').$type<OperationStatus>().notNull().default('planning'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ kioskIdx: uniqueIndex('operations_kiosk_token_idx').on(t.kioskToken) }));

export const operationMembers = pgTable('operation_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<'lead' | 'assistant'>().notNull().default('assistant'),
}, (t) => ({ memberIdx: uniqueIndex('operation_members_op_user_idx').on(t.operationId, t.userId) }));

export const volunteers = pgTable('volunteers', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  icsRole: text('ics_role').$type<IcsRole>().notNull(),
  phone: text('phone'),
  email: text('email'),
  onSite: boolean('on_site').notNull().default(true),
  arriveDate: date('arrive_date'),
  arriveMeal: text('arrive_meal').$type<Meal>(),
  departDate: date('depart_date'),
  departMeal: text('depart_meal').$type<Meal>(),
  epipenCarrying: boolean('epipen_carrying').notNull().default(false),
  epipenLocation: text('epipen_location'),
  likes: jsonb('likes').$type<string[]>().notNull().default([]),
  dislikes: jsonb('dislikes').$type<string[]>().notNull().default([]),
  morale: jsonb('morale').$type<string[]>().notNull().default([]),
  /**
   * PPE sizes, scheme -> option (see lib/sizes.ts). Additive: an older build
   * simply ignores this column, so reverting the code does not strand data.
   */
  sizes: jsonb('sizes').$type<Record<string, string>>().notNull().default({}),
  freeNote: text('free_note'),
  source: text('source').$type<'kiosk' | 'lead'>().notNull().default('lead'),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const restrictions = pgTable('restrictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  volunteerId: uuid('volunteer_id').notNull().references(() => volunteers.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  severity: text('severity').$type<Severity>().notNull(),
  note: text('note'),
});

export const resourceDemands = pgTable('resource_demands', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  icsRole: text('ics_role').$type<IcsRole>().notNull(),
  day: date('day').notNull(),
  target: integer('target').notNull().default(0),
}, (t) => ({ demandIdx: uniqueIndex('resource_demands_op_role_day_idx').on(t.operationId, t.icsRole, t.day) }));

export const travel = pgTable('travel', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  volunteerId: uuid('volunteer_id').references(() => volunteers.id, { onDelete: 'set null' }),
  direction: text('direction').$type<TravelDirection>().notNull(),
  day: date('day').notNull(),
  fromLoc: text('from_loc'),
  toLoc: text('to_loc'),
  flight: text('flight'),
  dep: text('dep'),
  arr: text('arr'),
  rental: text('rental'),
  notes: text('notes'),
});

export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull().default('other'),
  defaultUnit: text('default_unit').notNull().default('g'),
  unitCost: numeric('unit_cost', { precision: 10, scale: 4 }).notNull().default('0'),
  packSize: numeric('pack_size', { precision: 10, scale: 3 }),
  packUnit: text('pack_unit'),
  packCost: numeric('pack_cost', { precision: 10, scale: 2 }),
  haveOnHand: numeric('have_on_hand', { precision: 10, scale: 3 }).notNull().default('0'),
});

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').$type<RecipeCategory>().notNull().default('main'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  method: text('method'),
  burners: integer('burners').notNull().default(0),
});

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  qtyPerServing: numeric('qty_per_serving', { precision: 10, scale: 4 }).notNull().default('0'),
  unit: text('unit').notNull().default('g'),
});

export const menuSlots = pgTable('menu_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  slot: text('slot').$type<Slot>().notNull(),
  /** null => use the computed headcount for that day + slot. */
  servings: integer('servings'),
}, (t) => ({ slotIdx: uniqueIndex('menu_slots_op_day_slot_idx').on(t.operationId, t.day, t.slot) }));

export const menuSlotItems = pgTable('menu_slot_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  menuSlotId: uuid('menu_slot_id').notNull().references(() => menuSlots.id, { onDelete: 'cascade' }),
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'cascade' }),
  adHocName: text('ad_hoc_name'),
});

export const mealChecks = pgTable('meal_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  slot: text('slot').$type<Slot>().notNull(),
  /**
   * What was checked and what the engine said. Deliberately stores the dish and
   * ingredient text plus a verdict — never the restriction data of the people it
   * was checked against. See PRIVACY.md.
   */
  dishText: text('dish_text').notNull(),
  verdict: text('verdict').$type<'clear' | 'hold'>().notNull(),
  conflictCount: integer('conflict_count').notNull().default(0),
  checkedBy: uuid('checked_by').references(() => users.id, { onDelete: 'set null' }),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kitItems = pgTable('kit_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: uuid('operation_id').notNull().references(() => operations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull().default('ppe'),
  /** single_use | per_deployment | periodic — see lib/kit.ts. */
  issuePolicy: text('issue_policy').notNull().default('single_use'),
  intervalDays: integer('interval_days').notNull().default(1),
  qtyPerPerson: numeric('qty_per_person', { precision: 10, scale: 2 }).notNull().default('1'),
  unit: text('unit').notNull().default('each'),
  /** Null when the item is one-size. Otherwise a scheme from lib/sizes.ts. */
  sizeScheme: text('size_scheme'),
  stockOnHand: numeric('stock_on_hand', { precision: 12, scale: 2 }).notNull().default('0'),
  reorderLevel: numeric('reorder_level', { precision: 12, scale: 2 }).notNull().default('0'),
  leadTimeDays: integer('lead_time_days').notNull().default(2),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type KitItemRow = typeof kitItems.$inferSelect;

export type UserRow = typeof users.$inferSelect;
export type OperationRow = typeof operations.$inferSelect;
export type VolunteerRow = typeof volunteers.$inferSelect;
export type RestrictionRow = typeof restrictions.$inferSelect;
export type IngredientRow = typeof ingredients.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;
export type RecipeIngredientRow = typeof recipeIngredients.$inferSelect;
export type MenuSlotRow = typeof menuSlots.$inferSelect;
export type MenuSlotItemRow = typeof menuSlotItems.$inferSelect;
export type TravelRow = typeof travel.$inferSelect;
export type ResourceDemandRow = typeof resourceDemands.$inferSelect;
