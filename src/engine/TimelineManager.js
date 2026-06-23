import { Timeline } from "./Timeline.js";
import {
  buildChildContext,
  buildSiblingContext,
  buildParentTimelineContext,
} from "../../logic/contextBuilder.js";
import { getPostsByAuthor } from "../db.js";
import { getParentsOfNode } from "../../utilities/utilityFunctions.js";

export class TimelineManager {
  constructor(canvas, db) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.db = db;
    this.activeTimeline = null;
    this.isBusy = false; // Prevents overlapping animations

    this._bindEvents();
    this.uiOverlay = document.createElement("div");
    this.uiOverlay.className = "infoDiv";
    this.uiOverlay.id = "ui-overlay";

    // Add it to the DOM (inserting it right after the canvas)
    this.canvas.parentNode.insertBefore(
      this.uiOverlay,
      this.canvas.nextSibling,
    );
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.activeTimeline) {
      this.activeTimeline.render();
    }
  }

  // Real Graph Engine Boot Sequence
  async executeContextBoot(context) {
    if (this.isBusy) return;
    this.isBusy = true;

    // 1. Instantiate your actual Timeline with the calculated points
    this.activeTimeline = new Timeline(this.canvas, context.points);

    this.initializeHUD();

    this.hudLayer.innerHTML = "";

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
      this.showOverview(this.activeTimeline.focusedSegment);
      this.isBusy = false;
    }, 600);
  }

  update() {
    if (this.activeTimeline) {
      this.activeTimeline.update();
      this.updateHUDPositions();
    }
  }

  _bindEvents() {
    this.canvas.addEventListener("click", (e) => this._handleCanvasClick(e));
  }

  // arrow functions automatically bind 'this'
  _handleCanvasClick = (e) => {
    if (this.isBusy) return;

    if (!this.activeTimeline || !this.activeTimeline.isInteractive) {
      console.log("no activeimeline or not interactive");
      return;
    }

    const active = this.activeTimeline;

    // Get mouse X relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

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
      this.hudLayer.innerHTML = "";
      this.showOverview(validIndex);
      this.isBusy = false;
    }, 600);
  };

  async showOverview(index) {
    const currentUser = this.activeTimeline.children[index];

    if (!currentUser) return;

    // Clear previous state
    this.uiOverlay.classList.remove("active");

    // 1. Process Avatar Blob if it exists
    let avatarHTML = `<div class="avatar-placeholder">NO_UPLINK</div>`;
    if (currentUser.avatar) {
      const avatarUrl = URL.createObjectURL(currentUser.avatar);
      avatarHTML = `<img src="${avatarUrl}" class="profile-avatar" alt="Profile Uplink">`;
    }

    // 2. High-contrast data injection architecture (Updated with Avatar & Comms Log container)
    this.uiOverlay.innerHTML = `
    <div class="container">
        <div class="profile-avatar-wrapper">
        ${avatarHTML}
        </div>
        <div class="flex-wrapper">
            <div class="terminal-row">
                <span class="label">USER_NAME</span>
                <span class="value uppercase">${currentUser.firstName} ${currentUser.lastName}</span>
            </div>
            <div class="terminal-row">
                <span class="label">CHRONO_AGE</span>
                <span class="value">${currentUser.age ? currentUser.age : '<span class="system-flag-empty">[ UNVERIFIED-USER // NO-DATA ]</span>'}</span>
            </div>
            <div class="terminal-row">
                <span class="label">CIVIL_STATUS</span>
                <span class="value">${currentUser.relationshipStatus ? currentUser.relationshipStatus : '<span class="system-flag-empty">[ UNVERIFIED-USER // NO-DATA ]</span>'}</span>
            </div>
            <div class="terminal-row">
                <span class="label">INTERESTS</span>
                <span class="value">${currentUser.interests ? currentUser.interests : '<span class="system-flag-empty">[ UNVERIFIED-USER // NO-DATA ]</span>'}</span>
            </div>
            <div class="terminal-row">
                <span class="label">RELIGIOUS_BACKGROUND</span>
                <span class="value">${currentUser.religiousBackground || '<span class="system-flag-empty">[ UNRECORDED ]</span>'}</span>
            </div>
        </div>
    </div>
    
    <div class="action-matrix">
      <button class="nav-btn" id="parentsBtn" style="display: none;">[ VIEW PARENTS ]</button>
      <button class="nav-btn" id="siblingsBtn" style="display: none;">[ VIEW SIBLINGS ]</button>
      <button class="nav-btn" id="spouseBtn" style="display: none;">[ VIEW SPOUSE ]</button>
      <button class="nav-btn" id="childrenBtn" style="display: none;">[ VIEW CHILDREN ]</button>
    </div>
    <div class="terminal-row" id="unverifiedUser">
      <h2>[ No data for Unverified users ]</h2>
    </div>
    <div class="comms-log" id="user-posts-feed">
      <div class="system-flag-empty flicker">[ FETCHING SECURE COMMS LOGS... ]</div>
    </div>
  `;

    const parentsBtn = this.uiOverlay.querySelector("#parentsBtn");
    const siblingsBtn = this.uiOverlay.querySelector("#siblingsBtn");
    const spouseBtn = this.uiOverlay.querySelector("#spouseBtn");
    const childrenBtn = this.uiOverlay.querySelector("#childrenBtn");
    const unverifiedUser = this.uiOverlay.querySelector("#unverifiedUser");
    const feedContainer = this.uiOverlay.querySelector("#user-posts-feed");

    const isUserAccessible = currentUser.isOrigin || currentUser.isVerified;

    if (isUserAccessible) {
      unverifiedUser.style.display = "none";
    } else {
      // If user is unverified, immediately lock down and truncate the feed container
      feedContainer.innerHTML = `<div class="system-flag-empty" style="color: var(--error, red)">[ INFO UNAVAILABLE // UNVERIFIED_USER ]</div>`;
    }

    if (this.activeTimeline.contextMetadata.timelineType === "PARENTS") {
      spouseBtn.style.display = "inline-block";
      spouseBtn.onclick = () => this.collapseToOverview();
    }

    // --- ASYNC GRAPH SCANNER & COMMS LOG PIPELINE ---
    try {
      // 1. Fetch Secure Comms Logs from IndexedDB in parallel with Graph processing (if authorized)
      let logsPromise = Promise.resolve([]);
      if (isUserAccessible) {
        logsPromise = getPostsByAuthor(this.db, currentUser.id);
      }

      // 2. Run your existing structural graph scanner queries
      const childContextPromise = buildChildContext(
        this.db,
        currentUser.id,
      ).catch(() => null);
      const siblingContextPromise = buildSiblingContext(
        this.db,
        currentUser.id,
      ).catch(() => null);

      // Await all parallel async tracks
      const [userPosts, childContext, siblingContext] = await Promise.all([
        logsPromise,
        childContextPromise,
        siblingContextPromise,
      ]);

      // 3. Render the Comms Log Feed if accessible
      if (isUserAccessible) {
        if (!userPosts || userPosts.length === 0) {
          feedContainer.innerHTML = `<div class="system-flag-empty" style="opacity: 0.5;">[ NO LOGS FOUND FOR THIS USER ]</div>`;
        } else {
          // Chronological order sorting (Newest entries first)
          userPosts.sort((a, b) => b.timestamp - a.timestamp);

          feedContainer.innerHTML = userPosts
            .map((post) => {
              const dateString = new Date(post.timestamp).toLocaleString();
              let mediaHTML = "";

              if (post.mediaAttached) {
                const mediaUrl = URL.createObjectURL(post.mediaAttached);
                mediaHTML = `<img src="${mediaUrl}" class="post-media" alt="Attached Media Resource">`;
              }

              return `
                <div class="post-entry">
                <h1>Posts by User</h1>
                <div class="post-meta">POST LOGGED ON // ${dateString}</div>
                <div class="post-text">${post.textContent}</div>
                ${mediaHTML}
                </div>
                `;
            })
            .join("");
        }
      }

      // 4. Toggle individual button navigation states (Your original scanner logic)
      const hasChildren =
        childContext && childContext.nodes && childContext.nodes.length > 0;
      const hasSiblings = siblingContext && siblingContext.nodes.length > 1;
      const hasParents =
        siblingContext &&
        siblingContext.parentIds &&
        (siblingContext.parentIds.father || siblingContext.parentIds.mother);

      if (hasChildren) {
        childrenBtn.style.display = "inline-block";
        childrenBtn.onclick = () => this.openChildrenTimeline(currentUser);
      }
      if (hasSiblings) {
        siblingsBtn.style.display = "inline-block";
        siblingsBtn.onclick = () => this.openSiblingsTimeline(currentUser);
      }
      if (hasParents) {
        parentsBtn.style.display = "inline-block";
        parentsBtn.onclick = () => this.openParentsTimeline(currentUser.id);
      }
    } catch (err) {
      console.error(
        "DIAGNOSTIC ERROR // CORE PIPELINE MATRIX RESOLUTION FAILED:",
        err,
      );
      if (isUserAccessible) {
        feedContainer.innerHTML = `<div class="system-flag-empty" style="color: red;">[ SYSTEM ERROR // LOG EXECUTION FAULT ]</div>`;
      }
    }

    // --- ANIMATION MATRIX KICKOFF ---
    void this.uiOverlay.offsetWidth;
    this.uiOverlay.classList.remove("closing");
    this.uiOverlay.classList.add("opening");
    this.uiOverlay.style.display = "flex";

    // Apply active class to trigger the CSS keyframe delays
    this.uiOverlay.classList.add("active");
  }

  collapseToOverview() {
    if (this.isBusy) return;
    this.isBusy = true;

    this.uiOverlay.classList.remove("opening", "active");
    this.uiOverlay.classList.add("closing");

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      await this.activeTimeline.resetView();
      this.initializeHUD();
      this.activeTimeline.isInteractive = true;
      this.isBusy = false;
    }, 600);
  }

  openChildrenTimeline(parentNode) {
    if (this.isBusy) return;
    this.isBusy = true;

    const clickedSegment = this.activeTimeline.focusedSegment;
    this.activeTimeline.isInteractive = false;

    this.uiOverlay.classList.remove("opening");
    this.uiOverlay.classList.add("closing");

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";

      try {
        // Fetch child context using parent's graph parameters
        const childrenTimeline = await buildChildContext(
          this.db,
          parentNode.id,
        );

        // Execute clean boot sequence for the child generation
        this.activeTimeline = new Timeline(
          this.canvas,
          childrenTimeline.points,
        );

        // 2. Map the context data arrays directly into your timeline memory slot
        this.activeTimeline.children = childrenTimeline.nodes;
        this.activeTimeline.contextMetadata = childrenTimeline;
        this.activeTimeline.focusedSegment = clickedSegment;

        this.initializeHUD();

        await this.activeTimeline.camera.applyEntryEffect(this.activeTimeline);
        this.activeTimeline.isInteractive = true;
      } catch (err) {
        console.error("DIAGNOSTIC ERROR // DIVE PIPELINE CRASHED:", err);
      } finally {
        this.isBusy = false;
      }
    }, 600);
  }

  openSiblingsTimeline(currentUser) {
    if (this.isBusy) return;

    const active = this.activeTimeline;

    if (active.contextMetadata.timelineType === "SIBLINGS") {
      this.collapseToOverview();
      return;
    }

    this.isBusy = true;
    const clickedSegment = active.focusedSegment;
    active.isInteractive = false;

    this.uiOverlay.classList.remove("opening", "active");
    this.uiOverlay.classList.add("closing");

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      await active.camera.applyExitEffect(active);

      try {
        // Fetch child context using parent's graph parameters
        const siblingsContext = await buildSiblingContext(
          this.db,
          currentUser.id,
        );

        // Execute clean boot sequence for the child generation
        this.activeTimeline = new Timeline(this.canvas, siblingsContext.points);

        // Map the context data arrays directly into your timeline memory slot
        const siblingsTimeline = this.activeTimeline;
        siblingsTimeline.children = siblingsContext.nodes;
        siblingsTimeline.contextMetadata = siblingsContext;
        siblingsTimeline.focusedSegment = clickedSegment;

        this.initializeHUD();

        this._applyMacroJolt(siblingsTimeline);
        siblingsTimeline.isInteractive = true;
      } catch (err) {
        console.error("DIAGNOSTIC ERROR // DIVE PIPELINE CRASHED:", err);
        active.isInteractive = true;
      } finally {
        this.isBusy = false;
      }
    }, 600);
  }

  async openParentsTimeline(currentUserId) {
    const active = this.activeTimeline;
    if (!active || this.isBusy) return;

    this.isBusy = true;
    active.isInteractive = false;

    const parents = await getParentsOfNode(this.db, currentUserId);

    this.uiOverlay.classList.remove("opening", "active");
    this.uiOverlay.classList.add("closing");

    // Start DB fetch concurrently with the UI close animation for snappier feeling
    const contextPromise = buildParentTimelineContext(this.db, parents);

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      await active.camera.applyExitEffect(active);

      try {
        const context = await contextPromise;
        this.activeTimeline = new Timeline(this.canvas, context.points);

        this.activeTimeline.children = context.nodes;
        this.activeTimeline.contextMetadata = context;
        this.activeTimeline.focusedSegment = context.startIndex;
        this.activeTimeline.timelineType = "PARENTS";

        this.initializeHUD();

        this._applyMacroJolt(this.activeTimeline);

        this.activeTimeline.isInteractive = true;
      } catch (err) {
        console.error("DIAGNOSTIC ERROR // PARENTS PIPELINE CRASHED:", err);
        active.isInteractive = true;
      } finally {
        this.isBusy = false;
      }
    }, 600);
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
  }

  /**
   * Run this once when a timeline is loaded/built
   * It clears the HUD and generates fresh DOM nodes for every segment.
   */
  initializeHUD() {
    this.hudLayer = document.getElementById("hud-layer");
    this.hudLayer.innerHTML = "";

    this.hudElements = [];

    this.activeTimeline.children.forEach((node, index) => {
      const labelDiv = document.createElement("div");
      labelDiv.className = "segment-label";

      labelDiv.onclick = () => {
        this.activeTimeline.zoomIntoSegment(index);
        this.hudLayer.innerHTML = "";
        this.showOverview(index);
      };

      let thumbHTML = `<div class="thumb-placeholder">NO_ID</div>`;
      if (node.avatar) {
        const thumbUrl = URL.createObjectURL(node.avatar);
        thumbHTML = `<img src="${thumbUrl}" class="segment-thumb" alt="ID">`;
      }

      labelDiv.innerHTML = `
        ${thumbHTML}
        <span>${node.firstName.toUpperCase()}</span>
      `;

      this.hudLayer.appendChild(labelDiv);
      this.hudElements[index] = labelDiv;
    });
  }

  updateHUDPositions() {
    if (!this.hudElements || this.hudElements.length === 0) return;

    const viewRange =
      this.activeTimeline.camera.view.max - this.activeTimeline.camera.view.min;

    this.activeTimeline.children.forEach((node, index) => {
      const labelDiv = this.hudElements[index];
      if (!labelDiv) return;

      const progress = (index + 0.5) / (this.activeTimeline.points - 1);
      const nodeWorldX = progress * this.canvas.width;
      const screenX =
        ((nodeWorldX - this.activeTimeline.camera.view.min) / viewRange) *
        this.canvas.width;
      const screenY = this.canvas.height / 2;

      if (
        screenX < 0 ||
        screenX > this.canvas.clientWidth ||
        screenY < 0 ||
        screenY > this.canvas.clientHeight
      ) {
        labelDiv.style.display = "none";
      } else {
        const percentX = (screenX / this.canvas.width) * 100;
        const percentY = (screenY / this.canvas.height) * 100;
        labelDiv.style.display = "flex";
        labelDiv.style.left = `${percentX}%`;
        labelDiv.style.top = `${percentY}%`;
      }
    });
  }
}
