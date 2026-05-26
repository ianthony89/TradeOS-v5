// ============================================================
//  TradeOS v5 — PIN utilities
//  SHA-256 hash (client-safe, no bcrypt in browser)
//  Same approach as v4 for familiarity
// ============================================================

/**
 * Hash a PIN string using SHA-256.
 * Returns a hex string — safe to store in profiles.pin_hash.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data    = encoder.encode(pin)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify a plain PIN against a stored hash.
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const candidate = await hashPin(pin)
  return candidate === hash
}

/**
 * Validate PIN format: digits only, 4–8 characters.
 */
export function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d+$/.test(pin))        return { valid: false, error: 'PIN must be digits only' }
  if (pin.length < 4)            return { valid: false, error: 'PIN must be at least 4 digits' }
  if (pin.length > 8)            return { valid: false, error: 'PIN must be at most 8 digits' }
  return { valid: true }
}
