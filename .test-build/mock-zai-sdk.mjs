export let mockZaiBehavior = { mode: "success", content: "## Reasoning\n- Live AI test\n## Prescription\n1. Action\n## Open question\nNext?" };
export function setMockZaiBehavior(b) { mockZaiBehavior = b; }
export default class ZAI {
  static async create() {
    if (mockZaiBehavior.mode === "init_fail") throw new Error("ZAI init failed");
    return new ZAI();
  }
  chat = {
    completions: {
      create: async () => {
        if (mockZaiBehavior.mode === "completion_fail") throw new Error("Upstream 503");
        if (mockZaiBehavior.mode === "empty") return { choices: [{ message: { content: "" } }] };
        return { choices: [{ message: { content: mockZaiBehavior.content } }] };
      }
    }
  };
}
