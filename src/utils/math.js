/**
 * Converts a world coordinate to a screen pixel position.
 * * @param {number} worldX - The absolute coordinate in the timeline world.
 * @param {Object} camera - The camera object containing min and max view bounds.
 * @param {number} canvasWidth - The current width of the canvas.
 * @returns {number} The pixel position on the X-axis.
 */

export function getScreenX(worldX, camera, canvasWidth) {
  // Formula: (Target - Start) / TotalRange * TotalPixels
  return ((worldX - camera.min) / (camera.max - camera.min)) * canvasWidth;
}

export function getWorldX(screenX, camera, canvasWidth) {
  return camera.min + (screenX / canvasWidth) * (camera.max - camera.min);
}
