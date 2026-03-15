document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const reloadModelsBtn = document.getElementById('reload-models-btn');
  const modelSummary = document.getElementById('model-summary');
  const status = document.getElementById('status');

  let loadedModels = [];

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

  function normalizeModels(rawModels = []) {
    return rawModels
      .filter((m) => m && m.model_name)
      .map((m) => ({
        provider: (m.vendor || 'Unknown').trim(),
        modelName: m.model_name,
        label: (m.label || m.model_name).trim(),
        isByok: Boolean(m.is_byok),
      }));
  }

  function groupModels(models = []) {
    const grouped = new Map();
    models.forEach((m) => {
      const key = `${m.provider} | ${m.isByok ? 'BYOK' : 'Native'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(m);
    });

    return [...grouped.entries()]
      .map(([key, items]) => ({
        label: key,
        items: [...items].sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function renderModelOptions(models, selectedModel) {
    modelSelect.innerHTML = '';
    const groups = groupModels(models);
    groups.forEach((group) => {
      const og = document.createElement('optgroup');
      og.label = group.label;
      group.items.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.modelName;
        opt.textContent = item.label;
        og.appendChild(opt);
      });
      modelSelect.appendChild(og);
    });

    const hasSelected = models.some((m) => m.modelName === selectedModel);
    modelSelect.value = hasSelected ? selectedModel : (models[0]?.modelName || '');
  }

  async function fetchAndPopulateModels(apiKey, selectedModel = '') {
    if (!apiKey) {
      modelSelect.innerHTML = '';
      modelSelect.disabled = true;
      setModelSummary([]);
      return;
    }

    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option>Loading models...</option>';

    try {
      const response = await fetch('https://api.zo.computer/models/available', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key for model list');
      }
      if (!response.ok) {
        throw new Error(`Model list failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      loadedModels = normalizeModels(data.models || []);
      if (!loadedModels.length) {
        modelSelect.innerHTML = '<option>No models available</option>';
        modelSelect.disabled = true;
        setModelSummary([]);
        return;
      }

      renderModelOptions(loadedModels, selectedModel);
      modelSelect.disabled = false;
      setModelSummary(loadedModels);

      const byokCount = loadedModels.filter((m) => m.isByok).length;
      if (byokCount === 0) {
        showStatus('No BYOK models returned for this API key.', 'error');
      }
    } catch (error) {
      modelSelect.innerHTML = '<option>Unable to load models</option>';
      modelSelect.disabled = true;
      setModelSummary([]);
      showStatus(error.message, 'error');
    }
  }

  const result = await chrome.storage.sync.get(['zoApiKey', 'zoModel']);
  if (result.zoApiKey) apiKeyInput.value = result.zoApiKey;

  await fetchAndPopulateModels(result.zoApiKey || '', result.zoModel || '');

  reloadModelsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    await fetchAndPopulateModels(apiKey, modelSelect.value);
  });

  apiKeyInput.addEventListener('blur', async () => {
    const apiKey = apiKeyInput.value.trim();
    await fetchAndPopulateModels(apiKey, modelSelect.value);
  });

  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }
    if (!model) {
      showStatus('Please load/select a default model', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ zoApiKey: apiKey, zoModel: model });
      await fetchAndPopulateModels(apiKey, model);
      showStatus('Settings saved successfully!', 'success');
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
