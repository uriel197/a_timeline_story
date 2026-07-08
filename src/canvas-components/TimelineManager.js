import { HUDManager } from "./HUDmanager.js";
import { OverlayManager } from "./OverlayManager.js";
import { Timeline } from "./Timeline.js";
import { buildChildContext } from "../db/db_logic/contextBuilder.js";

export class TimelineManager {
  constructor(canvas, db) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.db = db;
    this.activeTimeline = null;
    this.isBusy = false; // Prevents overlapping animations
    this.hudManager = new HUDManager(this.canvas, this);
    this.overlayManager = new OverlayManager(db, this);

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener("click", (e) => this._handleCanvasClick(e));
    this.canvas.addEventListener("touchstart", this._handleTouch, {
      passive: false,
    });
    window.addEventListener("resize", () => this.handleResize());
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.activeTimeline) {
      this.activeTimeline.render();
    }
  }

  update() {
    if (this.activeTimeline) {
      this.activeTimeline.update();
      this.hudManager.updateHUDPositions();
    }
  }

  _handleTouch = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("click", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.canvas.dispatchEvent(mouseEvent);
  };

  // Real Graph Engine Boot Sequence
  async executeContextBoot(context) {
    if (this.isBusy) return;
    this.isBusy = true;

    this.hudManager.hudLayer.innerHTML = "";

    // 1. Instantiate your actual Timeline with the calculated points
    this.activeTimeline = new Timeline(this.canvas, context.points);

    // 2. Map the context data arrays directly into your timeline memory slot
    this.activeTimeline.children = context.nodes;
    this.activeTimeline.contextMetadata = context; // Stash for zoomBack parent tracks
    this.activeTimeline.focusedSegment = context.startIndex;

    // 3. Trigger your original macro entry camera stretch
    await this.activeTimeline.camera.applyEntryEffect(this.activeTimeline);

    // 4. Command the camera to interpolate toward the locked target index
    this.activeTimeline.zoomIntoSegment(this.activeTimeline.focusedSegment);

    // 5. Fire Terminal Cascade once camera easing stabilizes (~600ms matching lerpFactor)
    setTimeout(() => {
      this.overlayManager.showOverview(this.activeTimeline.focusedSegment);
      this.isBusy = false;
    }, 600);
  }

  // arrow functions automatically bind 'this'
  _handleCanvasClick = (e) => {
    if (this.isBusy || !this.activeTimeline?.isInteractive) return;

    // Get mouse X relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const active = this.activeTimeline;

    // A more robust way inside handleCanvasClick:
    const viewRange = active.camera.view.max - active.camera.view.min;

    // 1. Convert pixel click to "World Space" position (0 to 1)
    const worldX =
      ((mouseX / this.canvas.width) * viewRange + active.camera.view.min) /
      this.canvas.width;

    // 2. Turn that 0-1 into a segment index
    const segmentIndex = Math.floor(worldX * (active.points - 1));

    const validIndex = Math.max(0, Math.min(segmentIndex, active.points - 2));

    if (segmentIndex !== null) {
      active.zoomIntoSegment(validIndex);
    } else {
      console.log("segmentIndex == null");
    }

    this.isBusy = true;

    setTimeout(() => {
      // 2. Show the HTML Overlay
      this.overlayManager.showOverview(validIndex);
      this.isBusy = false;
    }, 600);
  };

  collapseToOverview() {
    this.overlayManager.collapseToOverview();
  }

  openChildrenTimeline(parentNode) {
    this.overlayManager.openChildrenTimeline(parentNode);
  }

  openSiblingsTimeline(currentUser) {
    this.overlayManager.openSiblingsTimeline(currentUser);
  }

  openParentsTimeline(currentUserId) {
    this.overlayManager.openParentsTimeline(currentUserId);
  }

  // --- PRIVATE HELPERS ---

  // Abstracts the "Behind The Head" focal stretch
  _applyMacroJolt(timeline) {
    const center = (timeline.camera.view.min + timeline.camera.view.max) / 2;
    const joltRange =
      (timeline.camera.view.max - timeline.camera.view.min) * 0.9;
    timeline.camera.view.min = center - joltRange / 2;
    timeline.camera.view.max = center + joltRange / 2;
  }

  handleResize() {
    // Get the wrapper element (the canvas parent)
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();

    // Sync internal resolution to the parent's actual size
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // 3. Update the Camera for the active timeline
    if (!this.activeTimeline) return;

    // Handle the Focus math based on the parent's new width
    if (this.activeTimeline.viewState === "FOCUS") {
      // Use the quiet snap method so it doesn't "re-open" the UI
      this.activeTimeline.zoomIntoSegment(this.activeTimeline.focusedSegment);
    } else {
      this.activeTimeline.camera.setTarget(0, this.canvas.width);
    }
    this.hudManager.onResize();
  }

  // Called by OverlayManager when switching timelines
  initializeHUD() {
    if (this.activeTimeline) {
      this.hudManager.initialize(this.activeTimeline.children);
    }
  }

  // Cleanup when destroying manager (optional)
  destroy() {
    this.hudManager.cleanup();
    this.overlayManager.cleanup();
    this.canvas.removeEventListener("click", this._handleCanvasClick);
  }

  // Memory cleanup helper
  cleanupObjectURLs() {
    // Call this when switching timelines or closing overlays
    if (this._createdURLs) {
      this._createdURLs.forEach((url) => URL.revokeObjectURL(url));
      this._createdURLs = [];
    }
  }
}
