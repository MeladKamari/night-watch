/**
 * Copy text on explicit user action only.
 * Prefers Clipboard API; falls back to a temporary textarea + execCommand.
 */
export async function copyTextToClipboard(text: string): Promise<'clipboard' | 'textarea'> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'clipboard'
    } catch {
      // Fall through to textarea path (permissions / insecure context).
    }
  }
  return copyViaTextarea(text)
}

function copyViaTextarea(text: string): 'textarea' {
  const doc = typeof document !== 'undefined' ? document : undefined
  if (!doc?.body) {
    throw new Error('Clipboard fallback requires a document body')
  }
  const area = doc.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  area.style.top = '0'
  doc.body.appendChild(area)
  area.focus()
  area.select()
  const ok = doc.execCommand('copy')
  area.remove()
  if (!ok) {
    throw new Error('Copy command was rejected')
  }
  return 'textarea'
}
