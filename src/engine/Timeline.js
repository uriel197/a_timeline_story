import { TimelineRegistry } from "../utils/registry.js";
import { Animation } from "./Animations.js";
import { Camera } from "./Camera.js";
import { fetchFromAPI } from "../utils/api/fetchAPI.js";
import { getNestedValue } from "../utils/utilityFunctions.js";

export class Timeline {
  constructor(parentId, canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.id = TimelineRegistry.generateKey(parentId, this.currentLevel);
    this.parentId = parentId;
    this.data = null;
    this.isLoaded = false;
    // Zoom state
    this.currentLevel = 0;
    this.levelHistory = [];
    this.focusedSegment = null;
    this.viewState = "OVERVIEW"; // Current state

    this.checkCache();
    this.camera = new Camera(canvas);
    this.animation = new Animation(canvas);

    //************************* */
    this.onBlur = null;
    this._bindEvents();
    this._loop();
  }

  checkCache() {
    if (TimelineRegistry.cache.has(this.id)) {
      this.data = TimelineRegistry.cache.get(this.id);
      this.isLoaded = true;
    } else {
      fetchFromAPI(this);
    }
  }

  _bindEvents() {
    this.canvas.addEventListener("click", (e) => this._onClick(e));
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    const index = Math.floor(
      (clickX / this.canvas.width) * (this.data.points - 1),
    );

    if (index < this.data.points - 1) {
      this.animation.zoomIntoSegment(index, this);
    }
  }

  reset() {
    this.camera.reset();
  }

  update() {
    this.camera.update();
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const zoom = this.camera.zoomFactor;
    // Line width thins out as zoom increases
    const lineWidth = Math.max(0, 4 * (1 - zoom / 5));
    const radius = Math.min(8 * Math.sqrt(zoom), 40);
    const points = [];

    // Points
    if (this.isLoaded) {
      for (let i = 0; i < this.data.points; i++) {
        points.push(this.camera.worldToScreen(i / (this.data.points - 1)));
      }
    }
    // Draw Line
    ctx.beginPath();
    ctx.moveTo(points[0], canvas.height / 2);
    ctx.lineTo(points.at(-1), canvas.height / 2);
    ctx.strokeStyle = "rgba(59, 122, 135, 1)"; // Dynamic from CSS
    ctx.globalAlpha = 0.3; // Make the line subtle
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // draw the Points
    points.forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180, 191, 196, 1)";
      ctx.shadowBlur = radius * 1.5;
      ctx.shadowColor = "rgba(180, 191, 196, 1)";
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  _enterChildLevel() {
    // Reset camera completely
    this.camera.view.min = 0;
    this.camera.view.max = this.canvas.width;
    this.camera.reset();

    this.animation.applyEntryEffect(this);
  }

  proceedToChild() {
    let parentIndex;
    if (this.levelHistory.length > 1) {
      parentIndex = this.levelHistory[this.levelHistory.length - 2].index;
    } else {
      parentIndex = null;
    }

    // 1. Identify which child branch we are taking
    const lastClick = this.levelHistory[this.levelHistory.length - 1];
    const currentSegmentIndex = lastClick.index;

    // 2. Increment level
    this.currentLevel += 1;
    // 3. Find the raw data for the new level in the cache
    const rawChildData = Array.from(TimelineRegistry.cache.values()).find(
      (b) => b?.currentLevel === this.currentLevel,
    );

    if (!rawChildData) {
      console.error("No data found for level", this.currentLevel);
      return;
    }

    // 4. Extract specific points for this branch using your utility
    const branchPoints = getNestedValue(
      rawChildData.points,
      parentIndex,
      currentSegmentIndex,
    );

    // 5. Update the "Chameleon" Timeline's skin
    this.data = {
      ...rawChildData,
      points: branchPoints,
    };

    this.viewState = "DEEP";
    this._enterChildLevel();
  }

  _loop() {
    const tick = () => {
      this.update();
      this.render();
      requestAnimationFrame(tick);
    };
    tick();
  }
}
