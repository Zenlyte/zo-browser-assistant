import assert from "node:assert/strict";

function canSend({ modelsReady, apiKey, context, selectedModel }) {
  return Boolean(modelsReady && apiKey && context && selectedModel);
}

assert.equal(canSend({ modelsReady: true, apiKey: "k", context: {}, selectedModel: "m" }), true);
assert.equal(canSend({ modelsReady: false, apiKey: "k", context: {}, selectedModel: "m" }), false);
assert.equal(canSend({ modelsReady: true, apiKey: "", context: {}, selectedModel: "m" }), false);
assert.equal(canSend({ modelsReady: true, apiKey: "k", context: null, selectedModel: "m" }), false);
console.log("model-ui-guards.test.js passed");
