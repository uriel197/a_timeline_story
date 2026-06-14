// engine/Timeline.js
import { Camera } from "./Camera.js";

export class Timeline {
  constructor(canvas, data, level, path = []) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opacity = 1;
    this.points = data.points;
    this.path = path;
    this.currentLevel = level;
    this.focusedSegment = null;
    this.camera = new Camera(canvas);

    this.isInteractive = false;
    this.viewState = "OVERVIEW";
  }

  update() {
    this.camera.update();
  }

  render() {
    const { ctx, canvas, camera, points } = this;

    const zoom = camera.zoomFactor;
    // Line width thins out as zoom increases
    const lineWidth = Math.max(0, 4 * (1 - zoom / 5));
    const radius = Math.min(8 * Math.sqrt(zoom), 40);
    const pointsArray = [];

    // Calculate screen positions
    for (let i = 0; i < points; i++) {
      pointsArray.push(camera.worldToScreen(i / (points - 1)));
    }

    // Draw connecting line
    ctx.beginPath();
    ctx.moveTo(pointsArray[0], canvas.height / 2);
    ctx.lineTo(pointsArray.at(-1), canvas.height / 2);
    ctx.strokeStyle = `rgba(59, 122, 135, ${this.opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Draw points
    pointsArray.forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 191, 196, ${this.opacity})`;
      ctx.shadowBlur = radius * 1.5;
      ctx.shadowColor = `rgba(180, 191, 196, ${this.opacity})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  zoomIntoSegment(index) {
    // 1. ALWAYS use the full canvas width as the reference point
    const worldWidth = this.canvas.width;

    // 2. Calculate segment size based on the total world, not the current zoom
    const segmentWidth = worldWidth / (this.points - 1);

    // 3. The coordinates are now absolute
    const newMin = index * segmentWidth;
    const newMax = (index + 1) * segmentWidth;

    // 4. Update the camera
    // If we are already here (during a resize), snap instantly to avoid shaking
    if (this.viewState === "FOCUS" && this.focusedSegment?.index === index) {
      this.camera.view.min = newMin;
      this.camera.view.max = newMax;
      this.camera.target.min = newMin;
      this.camera.target.max = newMax;
    } else {
      this.camera.setTarget(newMin, newMax);
    }

    this.viewState = "FOCUS";
    this.focusedSegment = { index, min: newMin, max: newMax };
  }

  resetView() {
    setTimeout(async () => {
      this.viewState = "OVERVIEW";
      this.camera.setTarget(0, this.canvas.width);
    }, 400);
  }
}
