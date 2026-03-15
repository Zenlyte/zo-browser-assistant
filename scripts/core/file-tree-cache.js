const CACHE_PREFIX = 'zo_file_tree_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(dirPath) {
  return CACHE_PREFIX + (dirPath || 'root').replace(/\//g, '_');
}

export async function getCachedFileTree(dirPath) {
  const key = getCacheKey(dirPath);
  const data = await chrome.storage.local.get([key]);
  const cached = data[key];
  
  if (!cached) return null;
  
  const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
  if (isExpired) {
    await clearFileTreeCache(dirPath);
    return null;
  }
  
  return cached.tree;
}

export async function setCachedFileTree(dirPath, tree) {
  const key = getCacheKey(dirPath);
  await chrome.storage.local.set({
    [key]: {
      tree,
      timestamp: Date.now()
    }
  });
}

export async function clearFileTreeCache(dirPath) {
  if (dirPath) {
    // Clear specific directory
    const key = getCacheKey(dirPath);
    await chrome.storage.local.remove([key]);
  } else {
    // Clear all file tree caches
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(k => k.startsWith(CACHE_PREFIX));
    if (keysToRemove.length) {
      await chrome.storage.local.remove(keysToRemove);
    }
  }
}

export async function isCacheValid(dirPath) {
  const key = getCacheKey(dirPath);
  const data = await chrome.storage.local.get([key]);
  const cached = data[key];
  
  if (!cached) return false;
  return Date.now() - cached.timestamp <= CACHE_TTL_MS;
}
