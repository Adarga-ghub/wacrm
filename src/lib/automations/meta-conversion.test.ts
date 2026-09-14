import { describe, expect, it, beforeEach, vi } from "vitest";
import crypto from "crypto";

const h = vi.hoisted(() => ({
  state: {
    config: null as Record<string, unknown> | null,
    contact: null as Record<string, unknown> | null,
    conversation: null as Record<string, unknown> | null,
  },
}));

vi.mock("./admin-client", () => {
  const { state } = h;
  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => {
        if (table === "whatsapp_config") return Promise.resolve({ data: state.config, error: null });
        if (table === "contacts") return Promise.resolve({ data: state.contact, error: null });
        if (table === "conversations") return Promise.resolve({ data: state.conversation, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    };
    return b;
  }
  return { supabaseAdmin: () => ({ from: (t: string) => builder(t) }) };
});

vi.mock("@/lib/whatsapp/encryption", () => ({
  decrypt: (v: string) => `decrypted:${v}`,
}));

const m = vi.hoisted(() => ({
  sendConversionEvent: vi.fn(async () => ({ eventsReceived: 1 })),
}));
vi.mock("@/lib/whatsapp/meta-api", () => ({
  sendConversionEvent: m.sendConversionEvent,
}));
const sendConversionEventMock = m.sendConversionEvent;

import { sendMetaConversionEvent } from "./meta-conversion";

const ACCOUNT = "acct-1";

beforeEach(() => {
  h.state.config = null;
  h.state.contact = null;
  h.state.conversation = null;
  sendConversionEventMock.mockClear();
});

describe("sendMetaConversionEvent", () => {
  it("skips (does not throw) when data sharing is disabled", async () => {
    h.state.config = {
      access_token: "enc",
      meta_ads_data_sharing_enabled: false,
      meta_dataset_id: "ds1",
    };
    h.state.contact = { phone: "5215512345678" };

    const result = await sendMetaConversionEvent({
      accountId: ACCOUNT,
      contactId: "c1",
      eventName: "Purchase",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/disabled/);
    expect(sendConversionEventMock).not.toHaveBeenCalled();
  });

  it("skips when no dataset id is configured", async () => {
    h.state.config = {
      access_token: "enc",
      meta_ads_data_sharing_enabled: true,
      meta_dataset_id: null,
    };
    h.state.contact = { phone: "5215512345678" };

    const result = await sendMetaConversionEvent({
      accountId: ACCOUNT,
      contactId: "c1",
      eventName: "Purchase",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/Dataset/);
    expect(sendConversionEventMock).not.toHaveBeenCalled();
  });

  it("sends a hashed phone + ctwa_clid when the contact has an ad referral on record", async () => {
    h.state.config = {
      access_token: "enc-token",
      meta_ads_data_sharing_enabled: true,
      meta_dataset_id: "ds1",
    };
    h.state.contact = { phone: "5215512345678" };
    h.state.conversation = { ad_referral_ctwa_clid: "clid-abc" };

    const result = await sendMetaConversionEvent({
      accountId: ACCOUNT,
      contactId: "c1",
      eventName: "Purchase",
      value: 199,
      currency: "MXN",
    });

    const expectedHash = crypto.createHash("sha256").update("5215512345678").digest("hex");
    expect(sendConversionEventMock).toHaveBeenCalledWith({
      datasetId: "ds1",
      accessToken: "decrypted:enc-token",
      eventName: "Purchase",
      hashedPhone: expectedHash,
      ctwaClid: "clid-abc",
      value: 199,
      currency: "MXN",
    });
    expect(result.sent).toBe(true);
    expect(result.reason).toMatch(/attributed via ctwa_clid/);
  });

  it("still sends (phone match only) when the contact has no ad referral on record", async () => {
    h.state.config = {
      access_token: "enc-token",
      meta_ads_data_sharing_enabled: true,
      meta_dataset_id: "ds1",
    };
    h.state.contact = { phone: "5215512345678" };
    h.state.conversation = { ad_referral_ctwa_clid: null };

    const result = await sendMetaConversionEvent({
      accountId: ACCOUNT,
      contactId: "c1",
      eventName: "Lead",
    });

    expect(sendConversionEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ ctwaClid: undefined }),
    );
    expect(result.sent).toBe(true);
    expect(result.reason).toMatch(/phone match only/);
  });
});
