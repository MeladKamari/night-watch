/**
 * Adds CSS styles from a string without assigning `style.cssText` or the `style`
 * attribute as a whole — avoids CSP `unsafe-inline` / `unsafe-eval` friction.
 * Observable behavior aligned with FingerprintJS OSS v5.3.0 `addStyleString`.
 */
export function addStyleString(style: CSSStyleDeclaration, source: string): void {
  for (const property of source.split(';')) {
    const match = /^\s*([\w-]+)\s*:\s*(.+?)(\s*!([\w-]+))?\s*$/.exec(property)
    if (match) {
      const [, name, value, , priority] = match
      if (name && value !== undefined) {
        // Last argument must be a string (empty when no priority) for IE11 parity.
        style.setProperty(name, value, priority || '')
      }
    }
  }
}
