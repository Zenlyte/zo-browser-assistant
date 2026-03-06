import assert from "node:assert/strict";
import { chooseInitialModel } from "../scripts/core/model-catalog.js";

const models = [
  { modelName: "m1", label: "M1" },
  { modelName: "m2", label: "M2" },
];

assert.equal(chooseInitialModel(models, "m2"), "m2");
assert.equal(chooseInitialModel(models, "m9"), "m1");
assert.equal(chooseInitialModel([], "m2"), "");
console.log("model-selection-session.test.js passed");
