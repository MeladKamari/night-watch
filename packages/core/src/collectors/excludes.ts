/**
 * Returns true when `item` is **not** present in `list`
 * (i.e. the list excludes the item).
 */
export function excludes<T extends string>(list: readonly T[], item: string): boolean {
  return !list.includes(item as T)
}
