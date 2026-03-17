export async function getSettings() {
  const data = await chrome.storage.sync.get(["zoApiKey", "zoModel", "zoHandle", "customSaveScript"]);
  return {
    apiKey: data.zoApiKey || "",
    model: data.zoModel || "openrouter:z-ai/glm-5",
    handle: data.zoHandle || "",
    customSaveScript: data.customSaveScript || "",
  };
}

export async function setSettings({ apiKey, model, handle, customSaveScript }) {
  await chrome.storage.sync.set({
    zoApiKey: apiKey,
    zoModel: model || "openrouter:z-ai/glm-5",
    zoHandle: handle || "",
    customSaveScript: customSaveScript || "",
  });
}
