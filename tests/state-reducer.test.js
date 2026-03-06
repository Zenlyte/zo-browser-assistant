import assert from "node:assert/strict";

function reducer(state, action) {
  if (action.type === "ADD_MESSAGE") return { ...state, messages: [...state.messages, action.payload] };
  if (action.type === "SWITCH_THREAD") return { ...state, threadId: action.payload.threadId, messages: action.payload.messages || [] };
  if (action.type === "CLEAR_THREAD") return { ...state, messages: [] };
  if (action.type === "HYDRATE") return { ...state, ...action.payload };
  return state;
}

let s = { threadId: "a", messages: [] };
s = reducer(s, { type: "ADD_MESSAGE", payload: { role: "user", content: "hi" } });
assert.equal(s.messages.length, 1);
s = reducer(s, { type: "CLEAR_THREAD" });
assert.equal(s.messages.length, 0);
s = reducer(s, { type: "SWITCH_THREAD", payload: { threadId: "b", messages: [{ role: "assistant", content: "ok" }] } });
assert.equal(s.threadId, "b");
assert.equal(s.messages.length, 1);
console.log("state-reducer.test.js passed");
