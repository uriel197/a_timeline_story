import {
  buildChildContext,
  buildSiblingContext,
  buildParentTimelineContext,
} from "../db/db_logic/contextBuilder.js";
import { getPostsByAuthor } from "../db/db.js";
import { getParentsOfNode } from "../db/db_logic/utilityFunctions.js";
import { MenuBar } from "./MenuBar.js";

export class OverlayManager {
  constructor(db, manager) {
    this.db = db;
    this.manager = manager;
    this.uiOverlay = null;
    this.menuBar = null;
    this._createdURLs = new Set(); // Memory management for object URLs
    this._initOverlay();
  }

  _initOverlay() {
    this.uiOverlay = document.createElement("div");
    this.uiOverlay.className = "infoDiv";
    this.uiOverlay.id = "ui-overlay";
    this.manager.canvas.parentNode.insertBefore(
      this.uiOverlay,
      this.manager.canvas.nextSibling,
    );
  }

  async showOverview(index) {
    const activeTimeline = this.manager.activeTimeline;

    if (!activeTimeline) return;

    const currentUser = activeTimeline.children[index];

    if (!currentUser) return;

    this.cleanup(); // Clear previous media URLs
    this.uiOverlay.classList.remove("active");

    // Avatar
    let avatarHTML = `<div class="avatar-placeholder">NO_UPLINK</div>`;
    if (currentUser.avatar) {
      const avatarUrl = URL.createObjectURL(currentUser.avatar);
      this._createdURLs.add(avatarUrl);
      avatarHTML = `<img src="${avatarUrl}" class="profile-avatar" alt="Profile Uplink">`;
    }

    this.uiOverlay.innerHTML = `
    ${this.uiOverlay.innerHTML}
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
            <span class="value">${currentUser.age ? currentUser.age : '<span class="system-flag-empty">[ UNVERIFIED ]</span>'}</span>
          </div>
          <div class="terminal-row">
            <span class="label">CIVIL_STATUS</span>
            <span class="value">${currentUser.relationshipStatus ? currentUser.relationshipStatus : '<span class="system-flag-empty">[ UNVERIFIED ]</span>'}</span>
          </div>
          <div class="terminal-row">
            <span class="label">INTERESTS</span>
            <span class="value">${currentUser.interests ? currentUser.interests : '<span class="system-flag-empty">[ UNVERIFIED ]</span>'}</span>
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

      <div class="posts-container">
      <h2>Legacy Posts</h2>
        <div class="comms-log" id="user-posts-feed">
            <div class="system-flag-empty flicker">[ FETCHING SECURE COMMS LOGS... ]</div>
        </div>
      </div>
    `;

    const parentsBtn = this.uiOverlay.querySelector("#parentsBtn");
    const siblingsBtn = this.uiOverlay.querySelector("#siblingsBtn");
    const spouseBtn = this.uiOverlay.querySelector("#spouseBtn");
    const childrenBtn = this.uiOverlay.querySelector("#childrenBtn");
    const unverifiedUser = this.uiOverlay.querySelector("#unverifiedUser");
    const feedContainer = this.uiOverlay.querySelector("#user-posts-feed");

    // Add menu bar container at the top
    const menuContainer = document.createElement("div");
    menuContainer.id = "overlay-menu-bar";
    menuContainer.class = "menu-bar";
    this.uiOverlay.insertBefore(menuContainer, this.uiOverlay.firstChild);

    this.menuBar = new MenuBar(this, currentUser);
    this.menuBar.render(menuContainer);

    const isUserAccessible = currentUser.isOrigin || !currentUser.isVerified;

    if (isUserAccessible) {
      unverifiedUser.style.display = "none";
    } else {
      feedContainer.innerHTML = `<div class="system-flag-empty" style="color: var(--error, red)">[ INFO UNAVAILABLE // UNVERIFIED_USER ]</div>`;
    }

    // --- Button Setup & Async Data Loading ---
    try {
      const logsPromise = isUserAccessible
        ? getPostsByAuthor(this.db, currentUser.id)
        : Promise.resolve([]);

      const childContextPromise = buildChildContext(
        this.db,
        currentUser.id,
      ).catch(() => null);
      const siblingContextPromise = buildSiblingContext(
        this.db,
        currentUser.id,
      ).catch(() => null);

      const [userPosts, childContext, siblingContext] = await Promise.all([
        logsPromise,
        childContextPromise,
        siblingContextPromise,
      ]);

      // Render Posts
      if (isUserAccessible) {
        if (!userPosts?.length) {
          feedContainer.innerHTML = `<div class="system-flag-empty" style="opacity: 0.5;">[ NO LOGS FOUND FOR THIS USER ]</div>`;
        } else {
          userPosts.sort((a, b) => b.timestamp - a.timestamp);
          feedContainer.innerHTML = userPosts
            .map((post) => {
              const dateString = new Date(post.timestamp).toLocaleString();
              let mediaHTML = "";
              if (post.mediaAttached) {
                const mediaUrl = URL.createObjectURL(post.mediaAttached);
                this._createdURLs.add(mediaUrl);
                mediaHTML = `<img src="${mediaUrl}" class="post-media" alt="Attached Media">`;
              }
              return `
              <div class="post-entry">  
                <div class="post-meta">POST LOGGED ON // ${dateString}</div>
                <div class="post-text">${post.textContent || ""}</div>
                ${mediaHTML}
              </div>
            `;
            })
            .join("");
        }
      }

      // Navigation Buttons
      const hasChildren = childContext?.nodes?.length > 0;
      const hasSiblings = siblingContext?.nodes?.length > 1;
      const hasParents = !!(
        siblingContext?.parentIds?.father || siblingContext?.parentIds?.mother
      );

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

      if (activeTimeline.contextMetadata?.timelineType === "PARENTS") {
        spouseBtn.style.display = "inline-block";
        spouseBtn.onclick = () => this.collapseToOverview();
      }
    } catch (err) {
      console.error("Overlay data pipeline error:", err);
      feedContainer.innerHTML = `<div class="system-flag-empty" style="color: red;">[ SYSTEM ERROR ]</div>`;
    }

    // Trigger CSS animations
    setTimeout(() => {
      void this.uiOverlay.offsetWidth;
      this.uiOverlay.classList.remove("closing");
      this.uiOverlay.style.display = "flex";
      this.uiOverlay.classList.add("opening");
      this.uiOverlay.classList.add("active");
    }, 400);
  }

  collapseToOverview() {
    if (this.manager.isBusy) return;
    this.manager.isBusy = true;

    this.uiOverlay.classList.remove("opening", "active");
    this.uiOverlay.classList.add("closing");

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      if (this.manager.activeTimeline) {
        await this.manager.activeTimeline.resetView();
        this.manager.hudManager.initialize(
          this.manager.activeTimeline.children,
        );
        this.manager.activeTimeline.isInteractive = true;
      }
      this.manager.isBusy = false;
    }, 600);
  }

  async openChildrenTimeline(parentNode) {
    if (this.manager.isBusy) return;
    this.manager.isBusy = true;

    const active = this.manager.activeTimeline;
    active.isInteractive = false;

    this.uiOverlay.classList.add("closing");

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      this.cleanup();

      try {
        const childrenContext = await buildChildContext(this.db, parentNode.id);

        this.manager.activeTimeline = new (
          await import("./Timeline.js")
        ).Timeline(this.manager.canvas, childrenContext.points);

        const newTimeline = this.manager.activeTimeline;
        newTimeline.children = childrenContext.nodes;
        newTimeline.contextMetadata = childrenContext;
        newTimeline.focusedSegment = 0;

        await newTimeline.camera.applyEntryEffect(newTimeline);
        this.manager.initializeHUD();
        newTimeline.isInteractive = true;
      } catch (err) {
        console.error("Failed to open children timeline:", err);
      } finally {
        this.manager.isBusy = false;
      }
    }, 600);
  }

  async openSiblingsTimeline(currentUser) {
    const active = this.manager.activeTimeline;

    if (active.contextMetadata?.timelineType === "SIBLINGS") {
      this.collapseToOverview();
      this.manager.isBusy = false;
      return;
    }

    active.isInteractive = false;
    this.uiOverlay.classList.add("closing");

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      this.cleanup();
      await active.camera.applyExitEffect(active);

      try {
        const siblingsContext = await buildSiblingContext(
          this.db,
          currentUser.id,
        );

        this.manager.activeTimeline = new (
          await import("./Timeline.js")
        ).Timeline(this.manager.canvas, siblingsContext.points);

        const newTimeline = this.manager.activeTimeline;
        newTimeline.children = siblingsContext.nodes;
        newTimeline.contextMetadata = siblingsContext;
        newTimeline.focusedSegment = siblingsContext.startIndex || 0;

        this.manager.initializeHUD(newTimeline.children);
        this.manager._applyMacroJolt(newTimeline);
        newTimeline.isInteractive = true;
      } catch (err) {
        console.error("Failed to open siblings timeline:", err);
      } finally {
        this.manager.isBusy = false;
      }
    }, 600);
  }

  async openParentsTimeline(currentUserId) {
    if (this.manager.isBusy) return;
    this.manager.isBusy = true;

    const active = this.manager.activeTimeline;
    active.isInteractive = false;

    this.uiOverlay.classList.add("closing");

    const parents = await getParentsOfNode(this.db, currentUserId);
    const contextPromise = buildParentTimelineContext(this.db, parents);

    setTimeout(async () => {
      this.uiOverlay.style.display = "none";
      this.cleanup();
      await active.camera.applyExitEffect(active);

      try {
        const context = await contextPromise;

        this.manager.activeTimeline = new (
          await import("./Timeline.js")
        ).Timeline(this.manager.canvas, context.points);

        const newTimeline = this.manager.activeTimeline;
        newTimeline.contextMetadata = context;
        newTimeline.children = context.nodes;
        newTimeline.focusedSegment = context.startIndex || 0;
        newTimeline.timelineType = "PARENTS";

        this.manager.initializeHUD();
        this.manager._applyMacroJolt(newTimeline);
        newTimeline.isInteractive = true;
      } catch (err) {
        console.error("Failed to open parents timeline:", err);
      } finally {
        this.manager.isBusy = false;
      }
    }, 600);
  }

  // === NEW DASHBOARD METHODS ===
  openEditForm(person) {
    import("../form/editPersonForm.js").then(({ renderEditPersonForm }) => {
      renderEditPersonForm(this.uiOverlay, this.db, person, () => {
        this.refreshCurrentOverview(); // Re-render after edit
      });
    });
  }

  openPostCreator(person) {
    // Replace the current content with PostCreator
    const oldContent = this.uiOverlay.innerHTML;

    import("./PostCreator.js").then(({ PostCreator }) => {
      const creator = new PostCreator(this.uiOverlay, this.db, person, () => {
        // Refresh the profile view after posting
        this.showOverview(this.manager.activeTimeline.focusedSegment);
      });
    });
  }

  openAddRelativeForm(person) {
    import("../form/addRelativeForm.js").then(({ renderAddRelativeForm }) => {
      renderAddRelativeForm(
        this.uiOverlay,
        this.db,
        () => {
          this.refreshCurrentOverview();
        },
        person,
      );
    });
  }

  refreshCurrentOverview() {
    // Re-show current person after edit
    console.log("returning to overview");

    if (this.manager.activeTimeline) {
      this.showOverview(this.manager.activeTimeline.focusedSegment);
    }
  }

  cleanup() {
    if (this.menuBar) this.menuBar.destroy(this.uiOverlay);
    this._createdURLs.forEach((url) => URL.revokeObjectURL(url));
    this._createdURLs.clear();
  }
}
