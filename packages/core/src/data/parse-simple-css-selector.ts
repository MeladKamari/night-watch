/**
 * Parses a CSS selector into tag name with HTML attributes.
 * Only single-element selectors are supported (no combinators).
 * Observable behavior aligned with FingerprintJS OSS v5.3.0 `parseSimpleCssSelector`.
 */
export function parseSimpleCssSelector(
  selector: string,
): [tag: string | undefined, attributes: Record<string, string[]>] {
  const errorMessage = `Unexpected syntax '${selector}'`
  const tagMatch = /^\s*([a-z-]*)(.*)$/i.exec(selector)
  if (!tagMatch) {
    throw new Error(errorMessage)
  }
  const tag = tagMatch[1] || undefined
  const attributes: Record<string, string[]> = {}
  const partsRegex = /([.:#][\w-]+|\[.+?\])/gi

  const addAttribute = (name: string, value: string) => {
    attributes[name] = attributes[name] || []
    attributes[name].push(value)
  }

  for (;;) {
    const match = partsRegex.exec(tagMatch[2] ?? '')
    if (!match) {
      break
    }
    const part = match[0]
    switch (part[0]) {
      case '.':
        addAttribute('class', part.slice(1))
        break
      case '#':
        addAttribute('id', part.slice(1))
        break
      case '[': {
        const attributeMatch = /^\[([\w-]+)([~|^$*]?=("(.*?)"|([\w-]+)))?(\s+[is])?\]$/.exec(part)
        if (attributeMatch) {
          addAttribute(attributeMatch[1]!, attributeMatch[4] ?? attributeMatch[5] ?? '')
        } else {
          throw new Error(errorMessage)
        }
        break
      }
      default:
        throw new Error(errorMessage)
    }
  }

  return [tag, attributes]
}
