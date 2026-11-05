/**
 * True when `func` appears to be a browser-provided native function.
 * Used by later browser detectors; safe under Node (returns false for JS functions).
 */
export function isFunctionNative(func: (...args: unknown[]) => unknown): boolean {
  return /^function\s.*?\{\s*\[native code]\s*}$/.test(String(func))
}
