/**
 * Live first-party playground entry.
 * Browser globals are touched only inside `boot()` after DOM is ready.
 */
import {
  ENABLED_SOURCE_COUNT,
  SDK_PACKAGE_NAME,
  SDK_PACKAGE_VERSION,
  SDK_PRODUCT_LABEL,
  SOURCE_MANIFEST_REVISION,
} from '@thenightwatch/browser-sdk'
import { mountPlayground } from './ui.js'
import './styles.css'

export interface PlaygroundBootstrapInfo {
  readonly product: typeof SDK_PRODUCT_LABEL
  readonly packageName: typeof SDK_PACKAGE_NAME
  readonly packageVersion: typeof SDK_PACKAGE_VERSION
  readonly sourceManifestRevision: typeof SOURCE_MANIFEST_REVISION
  readonly enabledSourceCount: typeof ENABLED_SOURCE_COUNT
}

export function getPlaygroundBootstrapInfo(): PlaygroundBootstrapInfo {
  return {
    product: SDK_PRODUCT_LABEL,
    packageName: SDK_PACKAGE_NAME,
    packageVersion: SDK_PACKAGE_VERSION,
    sourceManifestRevision: SOURCE_MANIFEST_REVISION,
    enabledSourceCount: ENABLED_SOURCE_COUNT,
  }
}

function boot(): void {
  const mount = document.getElementById('playground-app')
  if (!mount) {
    throw new Error('Missing #playground-app mount node')
  }

  const info = getPlaygroundBootstrapInfo()
  const packageEl = document.getElementById('diag-package')
  const manifestEl = document.getElementById('diag-manifest')
  const sourcesEl = document.getElementById('diag-sources')
  const versionEl = document.getElementById('diag-version')
  if (packageEl) {
    packageEl.textContent = info.packageName
  }
  if (manifestEl) {
    manifestEl.textContent = info.sourceManifestRevision
  }
  if (sourcesEl) {
    sourcesEl.textContent = `${String(info.enabledSourceCount)} (applePay excluded)`
  }
  if (versionEl) {
    versionEl.textContent = info.packageVersion
  }

  mountPlayground(mount)
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  } else {
    boot()
  }
}
