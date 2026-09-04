/**
 * Standard kit by operation type.
 *
 * A new operation should start from a known loadout, not a blank page. These
 * are STARTING POINTS a logistics lead edits — quantities, lead times and stock
 * are local facts, so nothing here is treated as authoritative.
 *
 * Lead times default to 2 days because that is the resupply reality described
 * for these deployments; adjust per item once you know your supplier.
 */
import type { IssuePolicy, KitCategory } from './kit';
import type { SizeScheme } from './sizes';

export interface TemplateItem {
  readonly name: string;
  readonly category: KitCategory;
  readonly issuePolicy: IssuePolicy;
  readonly intervalDays?: number;
  readonly qtyPerPerson: number;
  readonly unit: string;
  readonly sizeScheme?: SizeScheme;
  readonly leadTimeDays?: number;
  readonly notes?: string;
}

export interface KitTemplate {
  readonly key: string;
  readonly label: string;
  readonly blurb: string;
  readonly items: readonly TemplateItem[];
}

/** Carried by every deployment regardless of task. */
const BASE: readonly TemplateItem[] = [
  { name: 'Greyshirt', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 2, unit: 'each', sizeScheme: 'shirt' },
  { name: 'Work gloves', category: 'ppe', issuePolicy: 'periodic', intervalDays: 3, qtyPerPerson: 1, unit: 'pair', sizeScheme: 'glove' },
  { name: 'Nitrile gloves', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 4, unit: 'pair', notes: 'Worn under work gloves; burn rate is high.' },
  { name: 'Safety glasses', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'each' },
  { name: 'Hard hat', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'each', sizeScheme: 'helmet' },
  { name: 'Steel-toe boots', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'pair', sizeScheme: 'boot', leadTimeDays: 5, notes: 'Long lead time — order against the roster early.' },
  { name: 'Hi-vis vest', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'each', sizeScheme: 'shirt' },
  { name: 'Hand sanitiser', category: 'sanitation', issuePolicy: 'single_use', qtyPerPerson: 0.05, unit: 'L' },
  { name: 'Drinking water', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 3, unit: 'L', notes: 'Raise in heat.' },
  { name: 'Contractor bags', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 3, unit: 'each' },
];

export const KIT_TEMPLATES: readonly KitTemplate[] = [
  {
    key: 'general',
    label: 'General deployment',
    blurb: 'Base PPE and consumables carried on any operation. Start here, then add the task template.',
    items: BASE,
  },
  {
    key: 'sifting',
    label: 'Fire — sifting',
    blurb: 'Ash and debris sifting on burned properties. Respiratory protection is the binding constraint.',
    items: [
      ...BASE,
      { name: 'P100 respirator', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'each', sizeScheme: 'mask', notes: 'Fit-test before issue.' },
      { name: 'P100 cartridges', category: 'consumable', issuePolicy: 'periodic', intervalDays: 2, qtyPerPerson: 2, unit: 'each', notes: 'Ash loads cartridges fast.' },
      { name: 'Tyvek coverall', category: 'ppe', issuePolicy: 'single_use', qtyPerPerson: 1, unit: 'each', sizeScheme: 'shirt', notes: 'Single use — ash contaminates.' },
      { name: 'Sifting screen', category: 'tool', issuePolicy: 'per_deployment', qtyPerPerson: 0.25, unit: 'each', notes: 'Shared — roughly one per four sifters.' },
      { name: 'Ash shovel', category: 'tool', issuePolicy: 'per_deployment', qtyPerPerson: 0.5, unit: 'each' },
      { name: 'Knee pads', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'pair' },
    ],
  },
  {
    key: 'muckout',
    label: 'Flood — muck-out',
    blurb: 'Gutting flood-damaged structures. Mould and standing water drive the consumables.',
    items: [
      ...BASE,
      { name: 'N95 respirator', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 2, unit: 'each', sizeScheme: 'mask', notes: 'Replace when wet — two a day is realistic.' },
      { name: 'Rubber boots', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'pair', sizeScheme: 'boot', leadTimeDays: 5 },
      { name: 'Tyvek coverall', category: 'ppe', issuePolicy: 'single_use', qtyPerPerson: 1, unit: 'each', sizeScheme: 'shirt' },
      { name: 'Pry bar', category: 'tool', issuePolicy: 'per_deployment', qtyPerPerson: 0.5, unit: 'each' },
      { name: 'Flat shovel', category: 'tool', issuePolicy: 'per_deployment', qtyPerPerson: 0.5, unit: 'each' },
      { name: 'Wheelbarrow', category: 'equipment', issuePolicy: 'per_deployment', qtyPerPerson: 0.2, unit: 'each' },
      { name: 'Mould treatment', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 0.5, unit: 'L' },
      { name: 'Dehumidifier', category: 'equipment', issuePolicy: 'per_deployment', qtyPerPerson: 0.1, unit: 'each', leadTimeDays: 4 },
    ],
  },
  {
    key: 'chainsaw',
    label: 'Chainsaw',
    blurb: 'Storm and windfall clearance. Cut-protection is per-sawyer and non-negotiable.',
    items: [
      ...BASE,
      { name: 'Chainsaw chaps', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'each', sizeScheme: 'shirt', notes: 'Sawyers only — do not issue to swampers.' },
      { name: 'Forestry helmet with visor and ear defence', category: 'ppe', issuePolicy: 'per_deployment', qtyPerPerson: 1, unit: 'each', sizeScheme: 'helmet' },
      { name: 'Cut-resistant gloves', category: 'ppe', issuePolicy: 'periodic', intervalDays: 5, qtyPerPerson: 1, unit: 'pair', sizeScheme: 'glove' },
      { name: 'Chainsaw', category: 'equipment', issuePolicy: 'per_deployment', qtyPerPerson: 0.34, unit: 'each', notes: 'Roughly one saw per three-person team.' },
      { name: 'Bar and chain oil', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 0.3, unit: 'L' },
      { name: 'Two-stroke fuel', category: 'consumable', issuePolicy: 'single_use', qtyPerPerson: 0.8, unit: 'L' },
      { name: 'Spare chain', category: 'consumable', issuePolicy: 'periodic', intervalDays: 2, qtyPerPerson: 0.34, unit: 'each' },
      { name: 'Felling wedges', category: 'tool', issuePolicy: 'per_deployment', qtyPerPerson: 0.34, unit: 'set' },
      { name: 'First aid / trauma kit', category: 'equipment', issuePolicy: 'per_deployment', qtyPerPerson: 0.2, unit: 'each', notes: 'One per team minimum for saw work.' },
    ],
  },
];

export function templateByKey(key: string): KitTemplate | undefined {
  return KIT_TEMPLATES.find((t) => t.key === key);
}
