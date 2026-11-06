import { Injectable, signal } from '@angular/core'
import type { ConsoleLoginResult } from '@thenightwatch/dashboard-client'
import type { Role } from './rbac'

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly session = signal<ConsoleLoginResult | null>(null)

  get roles(): Role[] {
    const role = this.session()?.role?.toLowerCase()
    if (!role) return []
    if (role.includes('admin') || role.includes('security') || role.includes('data')) return ['owner', 'admin']
    if (role.includes('analyst')) return ['analyst']
    return ['viewer']
  }

  set(login: ConsoleLoginResult): void {
    this.session.set(login)
    try {
      sessionStorage.setItem('night_watch_console_session', JSON.stringify(login))
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    this.session.set(null)
    try {
      sessionStorage.removeItem('night_watch_console_session')
    } catch {
      /* ignore */
    }
  }

  restore(): ConsoleLoginResult | null {
    try {
      const raw = sessionStorage.getItem('night_watch_console_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as ConsoleLoginResult
      this.session.set(parsed)
      return parsed
    } catch {
      return null
    }
  }
}
