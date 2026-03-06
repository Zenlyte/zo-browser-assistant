export async function getSettings() {
  const data = await chrome.storage.sync.get(["zoApiKey", "zoModel", "zoHandle"]);
  return {
    apiKey: data.zoApiKey || "",
    model: data.zoModel || "z-ai/glm-5",
    handle: data.zoHandle || "",
  };
}

export async function setSettings({ apiKey, model, handle }) {
  await chrome.storage.sync.set({
    zoApiKey: apiKey,
    zoModel: model || "z-ai/glm-5",
    zoHandle: handle || "",
  });
}
