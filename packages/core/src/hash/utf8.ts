/**
 * Converts a string to UTF-8 bytes.
 * ASCII-only paths avoid TextEncoder; non-ASCII uses TextEncoder (Node + browsers).
 * Behavior matches FingerprintJS OSS v5.3.0 `getUTF8Bytes`.
 */
export function getUTF8Bytes(input: string): Uint8Array {
  const result = new Uint8Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i)
    if (charCode > 127) {
      return new TextEncoder().encode(input)
    }
    result[i] = charCode
  }
  return result
}
