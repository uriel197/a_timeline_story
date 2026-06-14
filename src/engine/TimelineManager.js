import { Timeline } from "./Timeline.js";
import { fetchFromAPI } from "../utils/api/fetchAPI.js";
import { TimelineRegistry } from "../utils/api/registry.js";
import { getNestedValue } from "../utils/api/utiliityFunctions.js";

export class TimelineManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.stack = [];
    this.isBusy = false; // Prevents overlapping animations

    this._bindEvents();
    this.uiOverlay = document.createElement("div");
    this.uiOverlay.className = "infoDiv";

    // Add it to the DOM (inserting it right after the canvas)
    this.canvas.parentNode.insertBefore(
      this.uiOverlay,
      this.canvas.nextSibling,
    );
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.stack.length > 0) {
      this.top().render();
    } else {
      console.log("stack length = 0");
    }
  }

  // Helper to get the active timeline
  top() {
    return this.stack[this.stack.length - 1];
  }

  // Global Update: Only update the top layer
  update() {
    if (this.stack.length > 0) {
      this.top().update();
    } else {
      console.log("stack length = 0");
    }
  }

  _bindEvents() {
    this.canvas.addEventListener("click", (e) => this._handleCanvasClick(e));
  }

  // arrow functions automatically bind 'this'
  _handleCanvasClick = (e) => {
    if (this.isBusy) return;

    const activeTimeline = this.top();
    if (!activeTimeline || !activeTimeline.isInteractive) {
      console.log("no activeimeline or not interactive");
      return;
    }

    // Get mouse X relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // A more robust way inside handleCanvasClick:
    const viewRange =
      activeTimeline.camera.view.max - activeTimeline.camera.view.min;

    // 1. Convert pixel click to "World Space" position (0 to 1)
    const worldX =
      ((mouseX / this.canvas.width) * viewRange +
        activeTimeline.camera.view.min) /
      this.canvas.width;

    // 2. Turn that 0-1 into a segment index
    const segmentIndex = Math.floor(worldX * (activeTimeline.points - 1));

    const validIndex = Math.max(
      0,
      Math.min(segmentIndex, activeTimeline.points - 2),
    );

    if (segmentIndex !== null) {
      activeTimeline.zoomIntoSegment(validIndex);
    }
    setTimeout(() => {
      // 2. Show the HTML Overlay
      this.showOverview(validIndex);
      this.isBusy = false;
    }, 500);
  };

  // Add a cleanup method just in case you ever "reset" the app
  destroy() {
    this.canvas.removeEventListener("click", this._handleCanvasClick);
  }

  showOverview(index) {
    this.uiOverlay.innerHTML = `
    <div class="infoDiv-title">TIMELINE // SCANNER ACTIVE</div>
    <h3 id="overview-segment-title"></h3>
    <p>Target coordinates locked. Analyzing temporal drift in this era for anomalous patterns...
    Quick reflexes are indeed needed given that the UI is blazing fast and violent. further examination is required...</p>
    <div class="space-between">
    <button id="dive-btn">Go Deeper</button>
    <span style="font-size: 1.2rem; opacity: 0.4;">Scanning profile...</span>
    </div>
  `;

    // 2. Set the dynamic content safely as text (No XSS possible)
    this.uiOverlay.querySelector("#overview-segment-title").textContent =
      `Segment ${index}`;

    this.uiOverlay.classList.remove("closing");
    this.uiOverlay.classList.add("opening");
    this.uiOverlay.style.display = "flex";

    // Wire up the button dynamically
    this.uiOverlay.querySelector("#dive-btn").onclick = () =>
      this.handleDive(index);
  }

  handleDive(index) {
    if (this.isBusy) return;
    const parent = this.top();

    // Construct the coordinates for the child
    const nextPath = [...parent.path, index];
    const nextLevel = nextPath.length;

    const levelBlock = TimelineRegistry.cache.get(nextLevel);
    if (!levelBlock) {
      console.error(`Data for level, ${nextLevel}, not loaded yet!`);
      return;
    }

    const points = getNestedValue(levelBlock?.points, nextPath);

    // 4. Create a clean data object for the child
    const nextTimeline = {
      ...levelBlock,
      points,
    };

    this.isBusy = true;
    this.uiOverlay.classList.remove("opening");
    this.uiOverlay.classList.add("closing");

    // Wait for 400ms (the CSS animation duration) before proceeding
    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      const child = new Timeline(
        this.canvas,
        nextTimeline,
        nextLevel,
        nextPath,
      );

      this.stack.push(child);
      await child.camera.applyEntryEffect(child);
      this.isBusy = false;
    }, 400);
  }

  async zoomBack() {
    if (this.isBusy) return;

    const active = this.top();
    if (!active) return; // SCENARIO: Already at the top and already zoomed out
    if (this.stack.length === 1 && active.viewState === "OVERVIEW") {
      console.log(
        "Already at the root overview. No further zoom-back possible.",
      );
      return; // Exit early without locking anything
    }

    this.isBusy = true;
    active.isInteractive = false;

    // SCENARIO A: We are deep in the stack (Level 1, 2, etc.)
    if (this.stack.length > 1 && active.viewState === "OVERVIEW") {
      await active.camera.applyExitEffect(active);
      this.isBusy = false;
      this.popLevel();
    }

    // SCENARIO B: We are on the base level, but zoomed in
    else if (active.viewState === "FOCUS") {
      this.uiOverlay.classList.remove("opening");
      this.uiOverlay.classList.add("closing");
      await active.resetView();
    }
    // CRITICAL: Always release the locks at the end of a valid transition
    this.isBusy = false;
    const currentTop = this.top();
    if (currentTop) currentTop.isInteractive = true;
  }

  async pushLevel(level) {
    if (this.isBusy || isNaN(level)) return;
    this.isBusy = true;

    const data = await fetchFromAPI({ currentLevel: level });
    const child = new Timeline(this.canvas, data, level);
    this.stack.push(child);
    await child.camera.applyEntryEffect(child);
    this.isBusy = false;
  }

  popLevel() {
    if (this.isBusy || this.stack.length <= 1) return;
    this.isBusy = true;
    this.stack.pop();

    const parent = this.top();
    const index = parent.focusedSegment.index;

    // --- THE "BEHIND THE HEAD" JOLT ---
    // 1. Calculate the current focal center
    const center = (parent.camera.view.min + parent.camera.view.max) / 2;

    // 2. Snap the camera to an EXTREME zoom (1% of current width)
    // This creates the "Macro" look that rushes past the user
    const joltRange = (parent.camera.view.max - parent.camera.view.min) * 0.9;
    parent.camera.view.min = center - joltRange / 2;
    parent.camera.view.max = center + joltRange / 2;

    // 2. Trigger the UI Overlay to "open" again for the parent's data
    //setTimeout(() => {
    this.showOverview(index);
    // 3. Reactivate
    parent.isInteractive = true;
    this.isBusy = false;
    //}, 100);
  }

  handleResize() {
    // Get the wrapper element (the canvas parent)
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();

    // Sync internal resolution to the parent's actual size
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // 3. Update the Camera for the active timeline
    const activeTimeline = this.top();
    if (!activeTimeline) return;

    // Handle the Focus math based on the parent's new width
    if (activeTimeline.viewState === "FOCUS" && activeTimeline.focusedSegment) {
      // Use the quiet snap method so it doesn't "re-open" the UI
      activeTimeline.zoomIntoSegment(activeTimeline.focusedSegment.index);
    } else {
      activeTimeline.camera.setTarget(0, this.canvas.width);
    }
  }
}
