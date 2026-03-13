export async function getSettings() {
  const data = await chrome.storage.sync.get(["zoApiKey", "zoModel"]);
  return {
    apiKey: data.zoApiKey || "",
    model: data.zoModel || "openrouter:z-ai/glm-5",
  };
}

export async function setSettings({ apiKey, model }) {
  await chrome.storage.sync.set({
    zoApiKey: apiKey,
    zoModel: model || "openrouter:z-ai/glm-5",
  });
}
