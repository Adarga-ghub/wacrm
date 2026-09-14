import { describe, expect, it, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: {
    config: null as Record<string, unknown> | null,
    lastInbound: null as Record<string, unknown> | null,
  },
}));

vi.mock("./encryption", () => ({
  decrypt: (v: string) => `decrypted:${v}`,
}));

const m = vi.hoisted(() => ({
  sendTypingIndicator: vi.fn(async () => undefined),
}));
vi.mock("./meta-api", () => ({
  sendTypingIndicator: m.sendTypingIndicator,
}));

import { sendTypingIndicatorForConversation } from "./typing-indicator";

function fakeDb() {
  const { state } = h;
  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => {
        if (table === "whatsapp_config") return { data: state.config, error: null };
        if (table === "messages") return { data: state.lastInbound, error: null };
        return { data: null, error: null };
      },
    };
    return b;
  }
  return { from: (t: string) => builder(t) } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const ACCOUNT = "acct-1";
const CONVERSATION = "conv-1";

beforeEach(() => {
  h.state.config = null;
  h.state.lastInbound = null;
  m.sendTypingIndicator.mockClear();
});

describe("sendTypingIndicatorForConversation", () => {
  it("no-ops (returns false) when WhatsApp isn't configured for the account", async () => {
    h.state.lastInbound = { message_id: "wamid.abc" };
    const sent = await sendTypingIndicatorForConversation({
      db: fakeDb(),
      accountId: ACCOUNT,
      conversationId: CONVERSATION,
    });
    expect(sent).toBe(false);
    expect(m.sendTypingIndicator).not.toHaveBeenCalled();
  });

  it("no-ops when the conversation has no inbound message on record", async () => {
    h.state.config = { phone_number_id: "pn-1", access_token: "enc" };
    h.state.lastInbound = null;
    const sent = await sendTypingIndicatorForConversation({
      db: fakeDb(),
      accountId: ACCOUNT,
      conversationId: CONVERSATION,
    });
    expect(sent).toBe(false);
    expect(m.sendTypingIndicator).not.toHaveBeenCalled();
  });

  it("sends, decrypting the token and referencing the latest inbound wamid", async () => {
    h.state.config = { phone_number_id: "pn-1", access_token: "enc-token" };
    h.state.lastInbound = { message_id: "wamid.latest" };
    const sent = await sendTypingIndicatorForConversation({
      db: fakeDb(),
      accountId: ACCOUNT,
      conversationId: CONVERSATION,
    });
    expect(sent).toBe(true);
    expect(m.sendTypingIndicator).toHaveBeenCalledWith({
      phoneNumberId: "pn-1",
      accessToken: "decrypted:enc-token",
      messageId: "wamid.latest",
    });
  });

  it("is best-effort — swallows a Meta API error and returns false", async () => {
    h.state.config = { phone_number_id: "pn-1", access_token: "enc-token" };
    h.state.lastInbound = { message_id: "wamid.latest" };
    m.sendTypingIndicator.mockRejectedValueOnce(new Error("Meta API error: 400"));

    const sent = await sendTypingIndicatorForConversation({
      db: fakeDb(),
      accountId: ACCOUNT,
      conversationId: CONVERSATION,
    });
    expect(sent).toBe(false);
  });
});
