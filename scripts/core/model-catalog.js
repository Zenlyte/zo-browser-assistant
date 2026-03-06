export function normalizeModels(rawModels = []) {
  return rawModels
    .filter((m) => m && m.model_name)
    .map((m) => ({
      provider: (m.vendor || "Unknown").trim(),
      modelName: m.model_name,
      label: (m.label || m.model_name).trim(),
      isByok: Boolean(m.is_byok),
      type: m.type || "unknown",
    }));
}

export function groupModels(models = []) {
  const grouped = new Map();
  models.forEach((m) => {
    const group = m.isByok ? `BYOK, ${m.provider}` : `Native, ${m.provider}`;
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(m);
  });

  return [...grouped.entries()]
    .map(([label, items]) => ({
      label,
      items: [...items].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function chooseInitialModel(models = [], defaultModel = "") {
  if (!models.length) return "";
  const found = models.find((m) => m.modelName === defaultModel);
  return found ? found.modelName : models[0].modelName;
}
