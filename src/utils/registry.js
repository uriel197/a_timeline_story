export const TimelineRegistry = {
  cache: new Map(), // Stores raw data from API

  // Create a unique key like "root-2-0"
  generateKey(parentId, currentLevel) {
    return parentId ? `${parentId}/${currentLevel}` : "root";
  },
};
