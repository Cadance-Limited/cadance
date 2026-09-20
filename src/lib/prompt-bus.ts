/**
 * Tiny event bus for cross-component communication.
 * Used by the command palette to trigger the demo chat with a prompt.
 */
export const PROMPT_EVENT = "cadence:prompt";

export function dispatchPrompt(prompt: string) {
  window.dispatchEvent(new CustomEvent(PROMPT_EVENT, { detail: prompt }));
}

export function onPrompt(handler: (prompt: string) => void) {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<string>;
    if (typeof ce.detail === "string") handler(ce.detail);
  };
  window.addEventListener(PROMPT_EVENT, listener);
  return () => window.removeEventListener(PROMPT_EVENT, listener);
}
