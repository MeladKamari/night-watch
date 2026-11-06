import {
  computed,
  onMounted,
  onUnmounted,
  shallowRef,
  type ComputedRef,
  type ShallowRef,
} from 'vue'
import {
  createNightWatchClient,
  type GetResult,
  type NightWatchClientOptions,
  type NightWatchSnapshot,
  type NightWatchStatus,
} from '@thenightwatch/vanilla'

export type UseVisitorDataOptions = NightWatchClientOptions & {
  enabled?: boolean
}

export type UseVisitorDataReturn = {
  status: ComputedRef<NightWatchStatus>
  visitorId: ComputedRef<string | null>
  version: ComputedRef<string | null>
  result: ComputedRef<GetResult | null>
  error: ComputedRef<Error | null>
  snapshot: ShallowRef<NightWatchSnapshot>
  refresh: () => Promise<void>
}

/** Vue 3 composable for Night Watch visitor identification. */
export function useVisitorData(options: UseVisitorDataOptions = {}): UseVisitorDataReturn {
  const { enabled = true, ...clientOptions } = options
  const client = createNightWatchClient(clientOptions)
  const snapshot = shallowRef<NightWatchSnapshot>(client.getSnapshot())

  const unsub = client.subscribe((next) => {
    snapshot.value = next
  })

  onMounted(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    void client.identify(false).catch(() => {
      /* error is on snapshot */
    })
  })

  onUnmounted(() => {
    unsub()
  })

  const refresh = async (): Promise<void> => {
    await client.identify(true)
  }

  return {
    status: computed(() => snapshot.value.status),
    visitorId: computed(() => snapshot.value.visitorId),
    version: computed(() => snapshot.value.version),
    result: computed(() => snapshot.value.result),
    error: computed(() => snapshot.value.error),
    snapshot,
    refresh,
  }
}
