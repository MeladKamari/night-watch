export type ConsoleModuleId =
  | 'tenant_config'
  | 'api_keys'
  | 'event_explorer'
  | 'visitor_graph'
  | 'smart_signals'
  | 'risk_rules'
  | 'suspect_score'
  | 'bot_monitor'
  | 'velocity'
  | 'fraud_cases'
  | 'usage_audit'
  | 'privacy_ops'
  | 'framework_wrappers'
  | 'enterprise_deploy'
  | 'api_docs'

export type ConsoleModule = {
  id: ConsoleModuleId
  titleFa: string
  titleEn: string
  route: string
  minRole: 'viewer' | 'analyst' | 'admin' | 'owner'
}

export const CONSOLE_MODULES: readonly ConsoleModule[] = [
  { id: 'tenant_config', titleFa: 'پیکربندی مستأجر', titleEn: 'Tenant config', route: '/settings/tenant', minRole: 'admin' },
  { id: 'api_keys', titleFa: 'کلیدها و وب‌هوک', titleEn: 'API keys & webhooks', route: '/keys', minRole: 'admin' },
  { id: 'event_explorer', titleFa: 'رویدادها', titleEn: 'Event explorer', route: '/events', minRole: 'viewer' },
  { id: 'visitor_graph', titleFa: 'گراف هویت', titleEn: 'Visitor graph', route: '/visitors', minRole: 'analyst' },
  { id: 'smart_signals', titleFa: 'سیگنال‌های هوشمند', titleEn: 'Smart signals', route: '/signals', minRole: 'analyst' },
  { id: 'risk_rules', titleFa: 'قوانین ریسک', titleEn: 'Risk rules', route: '/rules', minRole: 'admin' },
  { id: 'suspect_score', titleFa: 'نمره مشکوک', titleEn: 'Suspect score', route: '/score', minRole: 'analyst' },
  { id: 'bot_monitor', titleFa: 'پایش بات', titleEn: 'Bot monitor', route: '/bots', minRole: 'analyst' },
  { id: 'velocity', titleFa: 'سرعت ترافیک', titleEn: 'Velocity', route: '/velocity', minRole: 'analyst' },
  { id: 'fraud_cases', titleFa: 'پرونده تقلب', titleEn: 'Fraud cases', route: '/cases', minRole: 'analyst' },
  { id: 'usage_audit', titleFa: 'مصرف و حسابرسی', titleEn: 'Usage & audit', route: '/audit', minRole: 'admin' },
  { id: 'privacy_ops', titleFa: 'حریم خصوصی', titleEn: 'Privacy ops', route: '/privacy', minRole: 'admin' },
  { id: 'framework_wrappers', titleFa: 'پوشش فریم‌ورک', titleEn: 'Framework wrappers', route: '/docs/wrappers', minRole: 'viewer' },
  { id: 'enterprise_deploy', titleFa: 'استقرار سازمانی', titleEn: 'Enterprise deploy', route: '/deploy', minRole: 'owner' },
  { id: 'api_docs', titleFa: 'مستندات API', titleEn: 'API docs', route: '/docs/api', minRole: 'viewer' },
] as const

export const DEFERRED_NATIVE_SIGNAL_CATALOG = [
  'emulator_detection',
  'cloned_app_detection',
  'factory_reset_detection',
  'frida_detection',
  'jailbreak_root_detection',
  'location_spoofing_detection',
  'app_cloners_detection',
  'mitm_native_detection',
  'vpn_native_detection',
  'high_demand_native_device',
] as const

export const WEB_SMART_SIGNAL_IDS = [
  'browser_bot_detection',
  'ai_agent_detection',
  'browser_automation_agent_detection',
  'remote_access_detection',
  'high_activity_device',
  'virtual_machine_detection',
  'developer_tools_detection',
  'raw_device_attributes',
  'browser_tamper_detection',
  'anti_detect_browser_detection',
  'tampered_request_detection',
  'mitm_attack_detection',
  'vpn_detection',
  'proxy_detection',
  'incognito_detection',
  'privacy_focused_browser_detection',
  'ip_geolocation',
  'proximity_detection',
  'velocity_signals',
  'rare_device_detection',
  'ip_blocklist_matching',
] as const

export function modulesForRole(role: ConsoleModule['minRole']): ConsoleModule[] {
  const order = ['viewer', 'analyst', 'admin', 'owner'] as const
  const idx = order.indexOf(role)
  return CONSOLE_MODULES.filter((m) => order.indexOf(m.minRole) <= idx)
}
