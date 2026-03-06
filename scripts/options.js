document.addEventListener('DOMContentLoaded', async () => {
  const handleInput = document.getElementById('zo-handle');
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const reloadModelsBtn = document.getElementById('reload-models-btn');
  const modelSummary = document.getElementById('model-summary');
  const status = document.getElementById('status');
  const settingsLink = document.getElementById('settings-link');

  let loadedModels = [];

  function updateSettingsLink() {
    const handle = handleInput.value.trim();
    if (handle) {
      settingsLink.href = `https://${handle}.zo.computer/?t=settings&s=advanced`;
    } else {
      settingsLink.href = `https://app.zo.computer/?t=settings&s=advanced`;
    }
  }

  handleInput.addEventListener('input', updateSettingsLink);

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 3000);
  }

  function setModelSummary(models = []) {
    const byok = models.filter((m) => m.isByok).length;
    const native = models.length - byok;
    modelSummary.textContent = models.length
      ? `Loaded ${models.length} models. Native: ${native}. BYOK: ${byok}.`
      : '';
  }

  // Load existing settings
  const result = await chrome.storage.sync.get(['zoApiKey', 'zoModel', 'zoHandle']);
  if (result.zoHandle) {
    handleInput.value = result.zoHandle;
    updateSettingsLink();
  }
  if (result.zoApiKey) {
    apiKeyInput.value = result.zoApiKey;
  }
  if (result.zoModel) {
    modelSelect.value = result.zoModel;
  }

  async function refreshModels(key) {
    if (!key) return;
    try {
      const response = await fetch('https://api.zo.computer/models/available', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`Failed to load models: HTTP ${response.status}`);

      const data = await response.json();
      loadedModels = (data.models || [])
        .filter((m) => m && m.model_name)
        .map((m) => ({
          provider: (m.vendor || "Unknown").trim(),
          modelName: m.model_name,
          label: (m.label || m.model_name).trim(),
          isByok: Boolean(m.is_byok),
          type: m.type || "unknown",
        }));

      const groups = new Map();
      loadedModels.forEach((m) => {
        const group = m.isByok ? `BYOK, ${m.provider}` : `Native, ${m.provider}`;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(m);
      });

      const sortedGroups = [...groups.entries()]
        .map(([label, items]) => ({
          label,
          items: [...items].sort((a, b) => a.label.localeCompare(b.label)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const oldVal = modelSelect.value || result.zoModel;
      modelSelect.innerHTML = '';
      
      sortedGroups.forEach((g) => {
        const og = document.createElement('optgroup');
        og.label = g.label;
        g.items.forEach((item) => {
          const opt = document.createElement('option');
          opt.value = item.modelName;
          opt.textContent = item.label;
          og.appendChild(opt);
        });
        modelSelect.appendChild(og);
      });

      if (oldVal && [...modelSelect.options].some(o => o.value === oldVal)) {
        modelSelect.value = oldVal;
      }
      
      setModelSummary(loadedModels);
    } catch (e) {
      modelSelect.innerHTML = '<option>Unable to load models</option>';
      modelSummary.textContent = String(e.message || e);
    }
  }

  if (result.zoApiKey) {
    refreshModels(result.zoApiKey);
  } else {
    modelSelect.innerHTML = '<option>Enter API key to load models</option>';
  }

  apiKeyInput.addEventListener('blur', () => {
    if (apiKeyInput.value.trim()) refreshModels(apiKeyInput.value.trim());
  });

  reloadModelsBtn.addEventListener('click', () => {
    if (apiKeyInput.value.trim()) refreshModels(apiKeyInput.value.trim());
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const handle = handleInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({
        zoApiKey: apiKey,
        zoModel: model,
        zoHandle: handle
      });
      showStatus('Settings saved successfully!', 'success');
      refreshModels(apiKey);
    } catch (error) {
      showStatus(`Error saving: ${error.message}`, 'error');
    }
  });

  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      showStatus('Please enter an API key first', 'error');
      return;
    }
    if (!model) {
      showStatus('Please load/select a model first', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      const response = await fetch('https://api.zo.computer/zo/ask', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          input: 'Say "Connection successful!" in exactly those words.',
          model_name: model,
        }),
      });

      if (!response.ok) {
        showStatus(`Connection failed: HTTP ${response.status}`, 'error');
      } else {
        const data = await response.json();
        showStatus(`✓ Connection successful! Response: ${String(data.output || '').slice(0, 50)}...`, 'success');
      }
    } catch (error) {
      showStatus(`Connection failed: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  });
});
