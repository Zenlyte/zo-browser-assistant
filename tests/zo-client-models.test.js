import assert from "node:assert/strict";

function mapModelError(status) {
  if (status === 401 || status === 403) return "Invalid API key. Update it in Settings.";
  return `Failed to load models: HTTP ${status}`;
}

assert.equal(mapModelError(401), "Invalid API key. Update it in Settings.");
assert.equal(mapModelError(403), "Invalid API key. Update it in Settings.");
assert.equal(mapModelError(500), "Failed to load models: HTTP 500");
console.log("zo-client-models.test.js passed");
