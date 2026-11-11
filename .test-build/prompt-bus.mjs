/**
 * Cross-component event bus for demo prompts, tab switching, and waitlist count updates.
 * Queues prompts if DemoChat is not yet mounted (e.g., when switching from the Docs tab).
 */
export const PROMPT_EVENT = "cadence:prompt";
export const DEMO_TAB_EVENT = "cadence:demo-tab";
export const WAITLIST_UPDATED_EVENT = "cadence:waitlist-updated";
export const COOKIE_CONSENT_EVENT = "cadence:cookie-consent-updated";
let pendingPrompt = null;
export function dispatchDemoTab(tab) {
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent(DEMO_TAB_EVENT, { detail: tab }));
}
export function onDemoTab(handler) {
    if (typeof window === "undefined")
        return () => { };
    const listener = (e) => {
        const ce = e;
        if (ce.detail === "chat" || ce.detail === "docs") {
            handler(ce.detail);
        }
    };
    window.addEventListener(DEMO_TAB_EVENT, listener);
    return () => window.removeEventListener(DEMO_TAB_EVENT, listener);
}
export function dispatchPrompt(prompt) {
    if (typeof window === "undefined")
        return;
    pendingPrompt = prompt;
    dispatchDemoTab("chat");
    window.dispatchEvent(new CustomEvent(PROMPT_EVENT, { detail: prompt }));
}
export function consumePendingPrompt() {
    const p = pendingPrompt;
    pendingPrompt = null;
    return p;
}
export function onPrompt(handler) {
    if (typeof window === "undefined")
        return () => { };
    const listener = (e) => {
        const ce = e;
        if (typeof ce.detail === "string") {
            pendingPrompt = null;
            handler(ce.detail);
        }
    };
    window.addEventListener(PROMPT_EVENT, listener);
    return () => window.removeEventListener(PROMPT_EVENT, listener);
}
export function notifyWaitlistUpdated() {
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent(WAITLIST_UPDATED_EVENT));
}
export function onWaitlistUpdated(handler) {
    if (typeof window === "undefined")
        return () => { };
    window.addEventListener(WAITLIST_UPDATED_EVENT, handler);
    return () => window.removeEventListener(WAITLIST_UPDATED_EVENT, handler);
}
export function notifyCookieConsentUpdated() {
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}
export function onCookieConsentUpdated(handler) {
    if (typeof window === "undefined")
        return () => { };
    window.addEventListener(COOKIE_CONSENT_EVENT, handler);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler);
}
