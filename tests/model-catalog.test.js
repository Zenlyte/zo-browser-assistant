import assert from "node:assert/strict";
import { normalizeModels, groupModels, chooseInitialModel } from "../scripts/core/model-catalog.js";

const raw = [
  { model_name: "a:1", label: "One", vendor: "A", is_byok: false, type: "subscribers" },
  { model_name: "b:1", label: "Two", vendor: "B", is_byok: true, type: "byok" },
  { model_name: "a:2", label: "Three", vendor: "A", is_byok: false, type: "free" },
];

const models = normalizeModels(raw);
assert.equal(models.length, 3);
assert.equal(models[1].isByok, true);

const groups = groupModels(models);
assert.ok(groups.some((g) => g.label.includes("Native, A")));
assert.ok(groups.some((g) => g.label.includes("BYOK, B")));

assert.equal(chooseInitialModel(models, "a:2"), "a:2");
assert.equal(chooseInitialModel(models, "missing"), models[0].modelName);
console.log("model-catalog.test.js passed");
