import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeRecipientList,
  normalizeReminderRecipients,
  splitEmailList,
} from "./normalize-recipients.js";

describe("normalizeReminderRecipients", () => {
  it("deja principal y extras intactos si ya están separados", () => {
    assert.deepEqual(
      normalizeReminderRecipients("a@x.com", ["b@y.com", "c@z.com"]),
      { cliente_email: "a@x.com", extra_recipients: ["b@y.com", "c@z.com"] },
    );
  });

  it("normaliza CSV legacy en cliente_email", () => {
    assert.deepEqual(
      normalizeReminderRecipients("a@x.com, b@y.com; c@z.com", []),
      { cliente_email: "a@x.com", extra_recipients: ["b@y.com", "c@z.com"] },
    );
  });

  it("deduplica case-insensitive preservando el primer casing", () => {
    assert.deepEqual(
      normalizeReminderRecipients("A@x.com", ["a@x.com", "b@y.com"]),
      { cliente_email: "A@x.com", extra_recipients: ["b@y.com"] },
    );
  });

  it("mergeRecipientList une para SMTP", () => {
    assert.equal(mergeRecipientList("a@x.com", ["b@y.com"]), "a@x.com, b@y.com");
    assert.equal(splitEmailList("a@x.com,  b@y.com").length, 2);
  });
});
