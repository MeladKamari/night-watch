import { Inject, Injectable, InjectionToken, Optional } from '@angular/core'
import { BehaviorSubject, type Observable } from 'rxjs'
import {
  createNightWatchClient,
  type GetResult,
  type NightWatchClient,
  type NightWatchClientOptions,
  type NightWatchSnapshot,
} from '@thenightwatch/vanilla'

export const NIGHT_WATCH_OPTIONS = new InjectionToken<NightWatchClientOptions>(
  'NIGHT_WATCH_OPTIONS',
)

/**
 * Angular injectable wrapping the vanilla Night Watch client.
 * Provide via `provideNightWatch()` or `NightWatchService` in root.
 */
@Injectable({ providedIn: 'root' })
export class NightWatchService {
  private readonly client: NightWatchClient
  private readonly subject: BehaviorSubject<NightWatchSnapshot>
  private readonly unsub: () => void

  readonly snapshot$: Observable<NightWatchSnapshot>

  constructor(
    @Optional() @Inject(NIGHT_WATCH_OPTIONS) options: NightWatchClientOptions | null,
  ) {
    this.client = createNightWatchClient(options ?? {})
    this.subject = new BehaviorSubject(this.client.getSnapshot())
    this.snapshot$ = this.subject.asObservable()
    this.unsub = this.client.subscribe((next) => this.subject.next(next))
  }

  get snapshot(): NightWatchSnapshot {
    return this.subject.value
  }

  /** Collect (cached) or force refresh. */
  identify(force = false): Promise<GetResult> {
    return this.client.identify(force)
  }

  clear(): void {
    this.client.clear()
  }

  /** Call from `ngOnDestroy` only if this service is not root-scoped. */
  destroy(): void {
    this.unsub()
    this.subject.complete()
  }
}

export function provideNightWatch(options: NightWatchClientOptions = {}) {
  return [
    { provide: NIGHT_WATCH_OPTIONS, useValue: options },
    NightWatchService,
  ]
}
