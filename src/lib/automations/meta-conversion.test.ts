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
      meta_page_id: "page1",
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

  it("skips when the account has no Meta Page ID on record", async () => {
    h.state.config = {
      access_token: "enc",
      meta_ads_data_sharing_enabled: true,
      meta_dataset_id: "ds1",
      meta_page_id: null,
    };
    h.state.contact = { phone: "5215512345678" };

    const result = await sendMetaConversionEvent({
      accountId: ACCOUNT,
      contactId: "c1",
      eventName: "Purchase",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/Page ID/);
    expect(sendConversionEventMock).not.toHaveBeenCalled();
  });

  // Confirmed empirically against Meta's live API (error_subcode
  // 2804071): action_source business_messaging REJECTS the event
  // outright without a ctwa_clid — it is not an optional attribution
  // signal for this action_source. A contact who never clicked a
  // Click-to-WhatsApp ad has nothing Meta will accept, so this must
  // skip rather than call the API (or fabricate a click id).
  it("skips when the contact has no ad click on record — Meta requires ctwa_clid", async () => {
    h.state.config = {
      access_token: "enc-token",
      meta_ads_data_sharing_enabled: true,
      meta_dataset_id: "ds1",
      meta_page_id: "page1",
    };
    h.state.contact = { phone: "5215512345678" };
    h.state.conversation = { ad_referral_ctwa_clid: null };

    const result = await sendMetaConversionEvent({
      accountId: ACCOUNT,
      contactId: "c1",
      eventName: "Lead",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/no Click-to-WhatsApp ad click on record/);
    expect(sendConversionEventMock).not.toHaveBeenCalled();
  });

  it("sends a hashed phone + page_id + ctwa_clid when the contact has an ad referral on record", async () => {
    h.state.config = {
      access_token: "enc-token",
      meta_ads_data_sharing_enabled: true,
      meta_dataset_id: "ds1",
      meta_page_id: "page1",
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
      pageId: "page1",
      ctwaClid: "clid-abc",
      value: 199,
      currency: "MXN",
    });
    expect(result.sent).toBe(true);
    expect(result.reason).toMatch(/attributed via ctwa_clid/);
  });
});
