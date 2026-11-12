/**
 * Cross-component event bus for demo prompts, tab switching, waitlist updates,
 * cookie consent, and authenticated workspace run synchronization.
 */
export const PROMPT_EVENT = "cadence:prompt";
export const DEMO_TAB_EVENT = "cadence:demo-tab";
export const WAITLIST_UPDATED_EVENT = "cadence:waitlist-updated";
export const COOKIE_CONSENT_EVENT = "cadence:cookie-consent-updated";
export const WORKSPACE_UPDATED_EVENT = "cadence:workspace-updated";

export type DemoTab = "chat" | "docs";

let pendingPrompt: string | null = null;

export function dispatchDemoTab(tab: DemoTab) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DemoTab>(DEMO_TAB_EVENT, { detail: tab }));
}

export function onDemoTab(handler: (tab: DemoTab) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<DemoTab>;
    if (ce.detail === "chat" || ce.detail === "docs") {
      handler(ce.detail);
    }
  };
  window.addEventListener(DEMO_TAB_EVENT, listener);
  return () => window.removeEventListener(DEMO_TAB_EVENT, listener);
}

export function dispatchPrompt(prompt: string) {
  if (typeof window === "undefined") return;
  pendingPrompt = prompt;
  dispatchDemoTab("chat");
  window.dispatchEvent(new CustomEvent<string>(PROMPT_EVENT, { detail: prompt }));
}

export function consumePendingPrompt(): string | null {
  const p = pendingPrompt;
  pendingPrompt = null;
  return p;
}

export function onPrompt(handler: (prompt: string) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<string>;
    if (typeof ce.detail === "string") {
      pendingPrompt = null;
      handler(ce.detail);
    }
  };
  window.addEventListener(PROMPT_EVENT, listener);
  return () => window.removeEventListener(PROMPT_EVENT, listener);
}

export function notifyWaitlistUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WAITLIST_UPDATED_EVENT));
}

export function onWaitlistUpdated(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WAITLIST_UPDATED_EVENT, handler);
  return () => window.removeEventListener(WAITLIST_UPDATED_EVENT, handler);
}

export function notifyCookieConsentUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}

export function onCookieConsentUpdated(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(COOKIE_CONSENT_EVENT, handler);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler);
}

export function notifyWorkspaceUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_UPDATED_EVENT));
}

export function onWorkspaceUpdated(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WORKSPACE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(WORKSPACE_UPDATED_EVENT, handler);
}
