import ZAI from 'z-ai-web-dev-sdk'

/**
 * Shared ZAI singleton for backend-only usage.
 * Never import this from a client component.
 */
let zaiPromise: Promise<ZAI> | null = null

export function getZAI(): Promise<ZAI> {
  if (!zaiPromise) {
    zaiPromise = ZAI.create()
  }
  return zaiPromise
}
