/**
 * Provisions the single master account from environment variables on boot.
 * Idempotent — safe to run on every start. There is no public sign-up.
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from './index';
import { hashPin, MIN_PIN_LENGTH } from '../auth/password';

export async function ensureMaster(): Promise<string> {
  const username = process.env.MASTER_USERNAME?.trim();
  const pin = process.env.MASTER_PIN?.trim();
  if (!username || !pin) return 'MASTER_USERNAME / MASTER_PIN not set — skipping.';
  if (pin.length < MIN_PIN_LENGTH) return `MASTER_PIN must be at least ${MIN_PIN_LENGTH} characters — skipping.`;

  const db = getDb();
  const existing = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  const name = process.env.MASTER_NAME?.trim() || username;

  if (existing.length === 0) {
    await db.insert(schema.users).values({
      username, name, pinHash: await hashPin(pin), isMaster: true, isActive: true,
    });
    return `Master account "${username}" created.`;
  }

  if (process.env.MASTER_RESET === 'true') {
    await db.update(schema.users)
      .set({ pinHash: await hashPin(pin), name, isActive: true })
      .where(eq(schema.users.username, username));
    return `Master account "${username}" PIN reset.`;
  }

  return `Master account "${username}" already present.`;
}
