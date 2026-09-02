/**
 * Shared domain vocabulary. Pure types + constants, no I/O, safe to import
 * from client components, server code and tests alike.
 */

export const MEALS = ['breakfast', 'lunch', 'supper'] as const;
export type Meal = (typeof MEALS)[number];

/** Menu slots = the served meals plus the two all-day slots. */
export const SLOTS = ['breakfast', 'lunch', 'supper', 'snack', 'drinks'] as const;
export type Slot = (typeof SLOTS)[number];

export function isMeal(slot: Slot): slot is Meal {
  return (MEALS as readonly string[]).includes(slot);
}

/** Lunch is a packed field lunch — no hot service. Only `pack` recipes qualify. */
export const PACKED_LUNCH_SLOT: Slot = 'lunch';

export const SEVERITIES = ['severe', 'intolerance', 'preference'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Ranking order for "warn loudly": severe first, always. */
export const SEVERITY_RANK: Record<Severity, number> = {
  severe: 0,
  intolerance: 1,
  preference: 2,
};

export const ICS_ROLES = [
  'IC',
  'PIO',
  'SO',
  'OSC',
  'PSC',
  'FSC',
  'LSC',
  'FUL',
  'Core Ops',
  'Site Survey',
  'AP',
  'JITT',
] as const;
export type IcsRole = (typeof ICS_ROLES)[number];

export const ICS_ROLE_LABELS: Record<IcsRole, string> = {
  IC: 'Incident Commander',
  PIO: 'Public Information Officer',
  SO: 'Safety Officer',
  OSC: 'Operations Section Chief',
  PSC: 'Planning Section Chief',
  FSC: 'Finance Section Chief',
  LSC: 'Logistics Section Chief',
  FUL: 'Food Unit Leader',
  'Core Ops': 'Core Operations',
  'Site Survey': 'Site Survey',
  AP: 'Assistance Provider',
  JITT: 'Just-In-Time Trainee',
};

export const RECIPE_CATEGORIES = ['main', 'side', 'snack', 'drink', 'condiment', 'staple'] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const TRAVEL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type TravelDirection = (typeof TRAVEL_DIRECTIONS)[number];

export const OPERATION_STATUSES = ['planning', 'active', 'demobilizing', 'closed'] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

/** `pack` marks a recipe as suitable for a cold packed field lunch. */
export const PACK_TAG = 'pack';
