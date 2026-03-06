import assert from "node:assert/strict";

function validateMessage(msg) {
  const known = ["THREAD_UPDATED", "ACTIVE_TAB_CHANGED", "OPEN_SIDE_PANEL"];
  return typeof msg === "object" && known.includes(msg.type);
}

assert.equal(validateMessage({ type: "THREAD_UPDATED" }), true);
assert.equal(validateMessage({ type: "OPEN_SIDE_PANEL" }), true);
assert.equal(validateMessage({ type: "UNKNOWN" }), false);
console.log("message-contract.test.js passed");
