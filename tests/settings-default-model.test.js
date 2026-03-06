import assert from "node:assert/strict";

function resolveSessionModel(defaultModel, available) {
  return available.includes(defaultModel) ? defaultModel : (available[0] || "");
}

assert.equal(resolveSessionModel("m2", ["m1", "m2"]), "m2");
assert.equal(resolveSessionModel("m9", ["m1", "m2"]), "m1");
assert.equal(resolveSessionModel("m9", []), "");
console.log("settings-default-model.test.js passed");
