export const TimelineRegistry = {
  cache: new Map(),
  generateKey(parentId, level) {
    return parentId ? `${parentId}/${level}` : "root";
  },
};
