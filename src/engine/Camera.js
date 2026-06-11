export class Camera {
  constructor(canvas) {
    this.canvas = canvas;

    this.view = { min: 0, max: canvas.width };
    this.target = { min: 0, max: canvas.width };
  }

  reset() {
    this.target.min = 0;
    this.target.max = this.canvas.width;
  }

  setTarget(min, max) {
    this.target.min = min;
    this.target.max = max;
  }

  update() {
    const zoomingOut =
      this.target.max - this.target.min > this.view.max - this.view.min + 1;

    const ease = zoomingOut ? 0.07 : 0.08;

    this.view.min += (this.target.min - this.view.min) * ease;
    this.view.max += (this.target.max - this.view.max) * ease;
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
}
