export class Camera {
  constructor(canvas) {
    this.canvas = canvas;

    // 'view' is where the camera is right now
    this.view = {
      min: 0,
      max: canvas.width,
    };

    // 'target' is where the camera wants to be
    this.target = {
      min: 0,
      max: canvas.width,
    };

    // Easing factor (0.1 = smooth/slow, 0.2 = snappier)
    this.lerpFactor = 0.18;
    // 1. Initial State: Camera view is 5x wider than canvas
    this.zoomOutFactor = 5;
  }

  update() {
    this.view.min += (this.target.min - this.view.min) * this.lerpFactor;
    this.view.max += (this.target.max - this.view.max) * this.lerpFactor;
  }

  setTarget(min, max) {
    this.target.min = min;
    this.target.max = max;
  }

  get zoomFactor() {
    return this.canvas.width / (this.view.max - this.view.min);
  }

  worldToScreen(t) {
    const padding = 20;
    const usableWidth = this.canvas.width - padding * 2;

    const x =
      (t * this.canvas.width - this.view.min) *
      (this.canvas.width / (this.view.max - this.view.min));

    return (x / this.canvas.width) * usableWidth + padding;
  }

  async applyEntryEffect(parent) {
    this.view.min = -this.canvas.width * this.zoomOutFactor;
    this.view.max = this.canvas.width * (this.zoomOutFactor + 1);

    // Wait for 500ms using async/await
    await new Promise((resolve) => setTimeout(resolve, 500));
    parent.isInteractive = true;
  }

  async applyExitEffect(timeline) {
    // Expand the view to 100x the canvas size
    const center = (this.view.min + this.view.max) / 2;
    const extremeRange = this.canvas.width * (this.zoomOutFactor * 4);

    const newMin = center - extremeRange / 2;
    const newMax = center + extremeRange / 2;

    // Set target and wait for the camera to finish its easing
    this.setTarget(newMin, newMax);

    // We fade the alpha out while it shrinks
    return new Promise(async (resolve) => {
      const fade = setInterval(() => {
        timeline.opacity = Math.max(0, timeline.opacity - 0.05);
        if (timeline.opacity <= 0) {
          timeline.opacity = 0;
          clearInterval(fade);
          resolve();
        }
      }, 16); // ~60fps
    });
  }
}
