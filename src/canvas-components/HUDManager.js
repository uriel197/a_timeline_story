export class HUDManager {
  constructor(canvas, manager) {
    this.canvas = canvas;
    this.manager = manager; // Reference to TimelineManager for navigation
    this.hudLayer = document.getElementById("hud-layer");
    this.hudElements = [];
    this._createdURLs = new Set(); // Track object URLs for cleanup
  }

  initialize(nodes) {
    if (!this.hudLayer) return;

    this.hudLayer.innerHTML = "";
    this.hudElements = [];
    this.cleanup(); // Clear old URLs

    nodes.forEach((node, index) => {
      const labelDiv = document.createElement("div");
      labelDiv.className = "segment-label";

      labelDiv.onclick = async (e) => {
        e.stopPropagation();
        this.hudLayer.innerHTML = "";
        await this.manager.activeTimeline.zoomIntoSegment(index);
        this.manager.overlayManager.showOverview(index);
      };

      // Convert to uppercase and replace any spaces with a <br> tag
      const displayName = (node.firstName || "UNKNOWN")
        .toUpperCase()
        .replace(/\s+/g, "<br>");

      let thumbHTML = `<div class="thumb-placeholder">NO_ID</div>`;
      if (node.avatar) {
        const thumbUrl = URL.createObjectURL(node.avatar);
        this._createdURLs.add(thumbUrl);
        thumbHTML = `<img src="${thumbUrl}" class="segment-thumb" alt="${node.firstName || "Unknown"}">`;
      }

      labelDiv.innerHTML = `
        ${thumbHTML}
        <span>${displayName}</span>
      `;

      this.hudLayer?.appendChild(labelDiv);
      this.hudElements[index] = labelDiv;
    });
  }

  updateHUDPositions() {
    if (!this.hudElements.length || !this.manager.activeTimeline) return;

    const active = this.manager.activeTimeline;
    const viewRange = active.camera.view.max - active.camera.view.min;

    active.children.forEach((node, index) => {
      const labelDiv = this.hudElements[index];
      if (!labelDiv) return;

      const progress = (index + 0.5) / (active.points - 1);
      const nodeWorldX = progress * this.canvas.width;
      const screenX =
        ((nodeWorldX - active.camera.view.min) / viewRange) * this.canvas.width;
      const screenY = this.canvas.height / 2;

      if (
        screenX < 0 ||
        screenX > this.canvas.width ||
        screenY < 0 ||
        screenY > this.canvas.height
      ) {
        labelDiv.style.display = "none";
      } else {
        labelDiv.style.display = "flex";
        labelDiv.style.left = `${(screenX / this.canvas.width) * 100}%`;
        labelDiv.style.top = `${(screenY / this.canvas.height) * 100}%`;
      }
    });
  }

  onResize() {
    // Re-position after resize
    this.updateHUDPositions();
  }

  cleanup() {
    this._createdURLs.forEach((url) => URL.revokeObjectURL(url));
    this._createdURLs.clear();
    this.hudLayer.innerHTML = "";
  }
}
