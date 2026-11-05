export type Role = 'viewer' | 'analyst' | 'admin' | 'owner'

export type RoutePermission = {
  path: string
  roles: readonly Role[]
}

export const ROUTE_PERMISSIONS: readonly RoutePermission[] = [
  { path: '/dashboard', roles: ['viewer', 'analyst', 'admin', 'owner'] },
  { path: '/events', roles: ['viewer', 'analyst', 'admin', 'owner'] },
  { path: '/visitors', roles: ['analyst', 'admin', 'owner'] },
  { path: '/signals', roles: ['analyst', 'admin', 'owner'] },
  { path: '/rules', roles: ['admin', 'owner'] },
  { path: '/score', roles: ['analyst', 'admin', 'owner'] },
  { path: '/bots', roles: ['analyst', 'admin', 'owner'] },
  { path: '/velocity', roles: ['analyst', 'admin', 'owner'] },
  { path: '/cases', roles: ['analyst', 'admin', 'owner'] },
  { path: '/keys', roles: ['admin', 'owner'] },
  { path: '/settings', roles: ['admin', 'owner'] },
  { path: '/audit', roles: ['admin', 'owner'] },
  { path: '/privacy', roles: ['admin', 'owner'] },
  { path: '/docs', roles: ['viewer', 'analyst', 'admin', 'owner'] },
  { path: '/deploy', roles: ['owner'] },
] as const

export function canActivateRoute(path: string, roles: readonly Role[]): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const rule =
    ROUTE_PERMISSIONS.find((r) => normalized === r.path) ??
    ROUTE_PERMISSIONS.find((r) => normalized.startsWith(r.path + '/'))
  if (!rule) return false
  return roles.some((role) => rule.roles.includes(role))
}

export function assertCsrfHeader(headers: Record<string, string>): boolean {
  const token = headers['x-csrf-token'] ?? headers['X-CSRF-Token']
  return typeof token === 'string' && token.length >= 16
}
