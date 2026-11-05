import { parseSimpleCssSelector } from '../data/parse-simple-css-selector.js'
import { assertBrowserEnvironment } from '../runtime/environment.js'
import { getDocument } from '../runtime/globals.js'
import { addStyleString } from './styles.js'

/**
 * Creates a DOM element that matches the given single-element selector.
 * Changing `style` uses {@link addStyleString} (not the style attribute) for CSP safety.
 * Pass `document` explicitly for tests / non-global documents.
 */
export function selectorToElement(selector: string, document?: Document): HTMLElement {
  let doc: Document
  if (document) {
    doc = document
  } else {
    assertBrowserEnvironment()
    const docProbe = getDocument()
    if (docProbe.status !== 'ok') {
      throw new TypeError('document is unavailable for selectorToElement')
    }
    doc = docProbe.value
  }

  const [tag, attributes] = parseSimpleCssSelector(selector)
  const element = doc.createElement(tag ?? 'div')
  for (const name of Object.keys(attributes)) {
    const value = attributes[name]!.join(' ')
    if (name === 'style') {
      addStyleString(element.style, value)
    } else {
      element.setAttribute(name, value)
    }
  }
  return element
}
