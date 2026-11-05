import { InjectionToken, inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { canActivateRoute, type Role } from './rbac'
import type { LocaleLayout } from './i18n-time'
import { SessionStore } from './session.store'
import { NIGHT_WATCH_API_CONFIG } from './api.service'

export type SessionToken = {
  roles: Role[]
  locale: string
  layout: LocaleLayout
}

export const NIGHT_WATCH_SESSION = new InjectionToken<SessionToken>('NIGHT_WATCH_SESSION')

export const roleGuard: CanActivateFn = (route) => {
  const sessionToken = inject(NIGHT_WATCH_SESSION)
  const sessions = inject(SessionStore)
  const config = inject(NIGHT_WATCH_API_CONFIG)
  const router = inject(Router)
  const path = '/' + (route.routeConfig?.path ?? '')

  if (config.networkEnabled) {
    const live = sessions.session() ?? sessions.restore()
    if (!live) return router.createUrlTree(['/login'])
    const roles = sessions.roles
    if (!canActivateRoute(path, roles)) return router.createUrlTree(['/dashboard'])
    return true
  }

  if (canActivateRoute(path, sessionToken.roles)) return true
  return router.createUrlTree(['/dashboard'])
}

export const guestGuard: CanActivateFn = () => {
  const sessions = inject(SessionStore)
  const config = inject(NIGHT_WATCH_API_CONFIG)
  const router = inject(Router)
  if (!config.networkEnabled) return true
  const live = sessions.session() ?? sessions.restore()
  if (live) return router.createUrlTree(['/dashboard'])
  return true
}
