/**
 * Drills down into a nested points array using a path of indices.
 * * @param {Array} data - The raw points data for the level (Array of Arrays or Numbers)
 * @param {Array} path - The breadcrumb array of indices [indexLvl0, indexLvl1, ...]
 * @returns {Number|undefined} - The specific point count or undefined if not found
 */
export function getNestedValue(data, path) {
  if (!data || !Array.isArray(path)) return undefined;

  // We use reduce to navigate deeper into the 'data' with every step in the 'path'
  return path.reduce((currentLevel, index) => {
    // If we still have an array, pick the next branch
    if (Array.isArray(currentLevel)) {
      return currentLevel[index];
    }
    // If it's no longer an array, we've reached the final number (the points)
    return currentLevel;
  }, data);
}
