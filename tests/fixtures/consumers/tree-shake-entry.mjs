/**
 * Minimal consumer used by the tree-shaking rollup smoke test.
 * Imports only hashing helpers — collectors / load must be droppable.
 */
export { hashComponents, componentsToCanonicalString, x64hash128 } from '@thenightwatch/core'
