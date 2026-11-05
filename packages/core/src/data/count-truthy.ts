/** Counts truthy entries — used by browser capability detectors. */
export function countTruthy(values: readonly unknown[]): number {
  let sum = 0
  for (const value of values) {
    if (value) {
      sum += 1
    }
  }
  return sum
}
