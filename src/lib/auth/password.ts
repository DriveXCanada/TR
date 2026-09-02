import bcrypt from 'bcryptjs';

/** PINs are short by design (gloved hands, cold, no keyboard). Cost 10 is the floor. */
const ROUNDS = 10;
export const MIN_PIN_LENGTH = 4;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pin, hash);
  } catch {
    return false;
  }
}
