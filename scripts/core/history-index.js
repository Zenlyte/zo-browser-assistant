export function sortHistory(metas) {
  return [...(metas || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
