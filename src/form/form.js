import { getOriginNode, saveNode, saveEdge, savePost } from "../db/db.js";
import { buildOriginContext } from "../db/db_logic/contextBuilder.js";
import {
  fetchAllNodes,
  getParentsOfNode,
  createEdge,
  fetchAllEdges,
} from "../utilities/utilityFunctions.js";
import { compressImageToBlob, renderSearchResults } from "./formUtilities.js";

export const setupForm = async (container, db, manager) => {
  const refreshUI = async () => {
    const origin = await getOriginNode(db);

    if (origin) {
      console.log(
        `Welcome back, ${origin.firstName}. Booting Timeline Engine...`,
      );
      renderAddRelativeForm(container, db, refreshUI);
      const originContext = await buildOriginContext(db);
      await manager.executeContextBoot(originContext);
    } else {
      console.log("No profile found. Launching initial setup form...");
      renderOriginForm(container, db, refreshUI);
    }
  };

  refreshUI();
};

function renderOriginForm(container, db, callback) {
  container.innerHTML = `
    <div class="title-bar">IDENTITY_SETUP // ORIGIN</div>
    
    <form id="origin-form" class="origin-form">
      <div class="form-group">
        <label>FIRST NAME</label>
        <input type="text" name="firstName" required>
      </div>

      <div class="form-group">
        <label>LAST NAME</label>
        <input type="text" name="lastName" required>
      </div>
      
      <div class="form-group">
        <label>AGE</label>
        <input type="number" name="age">
      </div>

      <div class="form-group">
        <label>RELATIONSHIP STATUS</label>
        <select id="relationship-status" name="relationshipStatus">
            <option value="single" selected>Single</option>
            <option value="spouse">Married</option>
            <option value="ex-spouse">Divorced / Widowed</option>
            <option value="partner">Unmarried Partner</option>
        </select>
      </div>

      <div id="new-coparent-ui" style="display: none;">
          <input type="text" name="coFirstName" placeholder="Spouse's first Name">
          <input type="text" name="coLastName" placeholder="Spouse's last Name">
          <label>PROFILE UPLINK (AVATAR)</label>
        <input type="file" id="coparent-pic-input" accept="image/*">
      </div>

      <div class="form-group">
        <label>RELIGIOUS BACKGROUND</label>
        <textarea name="religiousBackground" rows="3"></textarea>
      </div>

      <div class="form-group">
        <label>INTERESTS</label>
        <textarea name="interests" rows="4"></textarea>
      </div>

      <div class="form-group">
        <label>PROFILE UPLINK (AVATAR)</label>
        <input type="file" id="profile-pic-input" accept="image/*">
      </div>
      
      <div class="form-group" style="border: 1px dashed rgba(0, 255, 204, 0.4); padding: 15px; margin-top: 20px;">
        <label style="color: var(--accent);">INITIAL SECURE LOG (FIRST POST)</label>
        <textarea id="first-post-text" rows="3" placeholder="Enter initial timeline log..."></textarea>
        <label style="margin-top: 10px;">ATTACH MEDIA (OPTIONAL)</label>
        <input type="file" id="post-image-input" accept="image/*">
      </div>

      <button type="submit" class="btn-save">ESTABLISH ORIGIN</button>
    </form>
  `;

  const form = container.querySelector("#origin-form");
  const relationshipSelect = container.querySelector("#relationship-status");
  const coParent = container.querySelector("#new-coparent-ui");
  let selectedText;

  relationshipSelect.addEventListener("change", (e) => {
    if (e.target.value === "single") {
      coParent.style.display = "none";
    } else {
      selectedText = e.target.options[e.target.selectedIndex].text;
      coParent.style.display = "block";
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const originId = crypto.randomUUID();
    const avatarFile = document.getElementById("profile-pic-input").files[0];
    const coparentAvatarFile =
      document.getElementById("coparent-pic-input").files[0];
    const postText = document.getElementById("first-post-text").value.trim();
    const postMediaFile = document.getElementById("post-image-input").files[0];

    let avatarBlob = null;
    let coAvatarBlob = null;
    let postMediaBlob = null;

    try {
      // Compress avatar (400px width is plenty for a profile icon)
      if (avatarFile) {
        avatarBlob = await compressImageToBlob(avatarFile, 800, 0.8);
      }

      if (coparentAvatarFile) {
        coAvatarBlob = await compressImageToBlob(avatarFile, 800, 0.8);
      }
      // Compress post media (800px width for gallery viewing)
      if (postMediaFile) {
        postMediaBlob = await compressImageToBlob(postMediaFile, 800, 0.8);
      }
    } catch (compressionError) {
      console.error("Media compression failed:", compressionError);
      alert("Failed to process images. Continuing without media.");
    }

    const originUser = {
      id: originId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      age: data.age ? parseInt(data.age, 10) : null, // Fallback to null if empty
      relationshipStatus: selectedText,
      religiousBackground: data.religiousBackground
        ? data.religiousBackground.trim()
        : "",
      interests: data.interests ? data.interests.trim() : "",
      avatar: avatarBlob,
      isOrigin: true, // This guarantees they are the supreme master of this machine
      createdAt: Date.now(),
    };

    try {
      await saveNode(db, originUser);

      // If they are not single, and they typed a name, we build the partner!
      if (
        data.relationshipStatus !== "single" &&
        data.coFirstName &&
        data.coLastName
      ) {
        const partnerId = crypto.randomUUID();

        // Spin up the Partner Node
        const partnerNode = {
          id: partnerId,
          firstName: data.coFirstName.trim(),
          lastName: data.coLastName.trim(),
          relationshipStatus: selectedText,
          avatar: coAvatarBlob,
          isOrigin: false,
          createdAt: Date.now() + 1, // +1 ms so they predictably sort after the origin
        };

        // Forge the Link (Edge from Origin -> Partner)
        const forwardEdge = {
          id: crypto.randomUUID(),
          from: originId,
          to: partnerId,
          type: data.relationshipStatus, // e.g., "spouse", "partner"
        };

        // Forge the Link back (Edge from Partner -> Origin)
        // Bidirectional edges make querying the UI Overlay lightning fast later
        const reverseEdge = {
          id: crypto.randomUUID(),
          from: partnerId,
          to: originId,
          type: data.relationshipStatus,
        };

        // Write the new node and linkages to the database
        await saveNode(db, partnerNode);
        await saveEdge(db, forwardEdge);
        await saveEdge(db, reverseEdge);
      }

      if (postText || postMediaBlob) {
        const initialPost = {
          id: `post_${crypto.randomUUID()}`,
          authorId: originId,
          timestamp: Date.now(),
          textContent: postText,
          mediaAttached: postMediaBlob,
        };
        await savePost(db, initialPost);
      }

      // 6. Boot the engine
      callback();
    } catch (error) {
      console.error("Failed to save Origin:", error);
      alert("Critical error: Could not write Origin to local database.");
    }
  };
}

async function renderAddRelativeForm(
  container,
  db,
  callback,
  initialActiveId = null,
) {
  // 1. Fetch all people once for lightning-fast memory filtering
  const allNodes = await fetchAllNodes(db);
  const allEdges = await fetchAllEdges(db);

  // State variables for the form
  let selectedAnchorId = initialActiveId;
  let selectedCoParentId = null;

  container.innerHTML = `
    <div class="form-panel">
      <div class="title-bar">ADD_RELATIVE // GRAPH_EDGE</div>
      
      <div class="target-section">
        <label>1. WHO ARE WE ADDING A RELATIVE TO?</label>
        <input type="text" id="anchor-search" placeholder="Search by name...">
        <div id="anchor-search-results" class="search-results-dropdown"></div>
        <div id="selected-anchor-display" class="selected-target"></div>
      </div>

      <form id="add-relative-form" class="relative-form" style="display: none;">
        <hr/>
        <div class="form-group">
          <label>2. RELATIONSHIP TO RELATIVE</label>
          <select name="relationshipType" id="relationship-type" required>
            <option value="">-- SELECT --</option>
            <option value="father">FATHER</option>
            <option value="mother">MOTHER</option>
            <option value="sibling">SIBLING</option>
            <option value="child">CHILD</option>
            </select>
        </div>

        <div id="anchor-role-container" style="display: none; margin: 15px 0;">
            <label>3. WHAT IS YOUR ROLE TO THIS CHILD?</label>
            <select name="anchorRole" id="anchor-role" style="width: 100%; padding: 8px;">
                <option value="father">Father</option>
                <option value="mother">Mother</option>
            </select>
        </div>

        <div class="form-group" style="margin: 15px 0;">
          <label>4. RELATIVE'S FIRST NAME</label>
          <input type="text" name="firstName" required>
        </div>

        <div class="form-group" style="margin: 15px 0;">
          <label>5. RELATIVE'S LAST NAME</label>
          <input type="text" name="lastName" required>
        </div>

        <div class="form-group">
          <label>PROFILE UPLINK (AVATAR)</label>
          <input type="file" id="profile-pic-input" accept="image/*">
        </div>
      
        <div id="dynamic-coparent-section"></div>

        <button type="submit" class="btn-save">Save to DataBase</button>
      </form>
    </div>
  `;

  // --- DOM Elements ---
  const anchorInput = container.querySelector("#anchor-search");
  const anchorResults = container.querySelector("#anchor-search-results");
  const anchorDisplay = container.querySelector("#selected-anchor-display");
  const formElement = container.querySelector("#add-relative-form");
  const relationSelect = container.querySelector("#relationship-type");
  const anchorRoleContainer = container.querySelector("#anchor-role-container");
  const coParentSection = container.querySelector("#dynamic-coparent-section");

  // --- 2. Live Search Logic for the Target / Anchor ---

  anchorInput.addEventListener("input", (e) => {
    renderSearchResults(
      e.target.value,
      anchorResults,
      allNodes,
      allEdges,
      (id, name) => {
        selectedAnchorId = id;
        anchorInput.value = "";
        anchorResults.innerHTML = "";
        anchorDisplay.innerHTML = `Adding relative to: <strong>${name}</strong>`;
        formElement.style.display = "block"; // Unlock the form
      },
    );
  });

  // If passed an activeId on boot, auto-select them
  if (selectedAnchorId) {
    const preSelected = allNodes.find((n) => n.id === selectedAnchorId);
    if (preSelected) {
      anchorDisplay.innerHTML = `Adding relative to: <strong>${preSelected.firstName} ${preSelected.lastName}</strong>`;
      formElement.style.display = "block";
    }
  }

  // Dynamic Co-Parent Logic for "Child" ---
  relationSelect.addEventListener("change", (e) => {
    coParentSection.innerHTML = "";
    anchorRoleContainer.style.display = "none";

    if (e.target.value === "child") {
      anchorRoleContainer.style.display = "block";
      coParentSection.innerHTML = `
        <hr/>
        <div class="form-group">
            <label>6. WHO IS THE OTHER PARENT?</label>
            
            <div class="coparent-toggle">
                <label>
                    <input type="radio" name="coparentType" value="existing" checked> 
                    Search Existing Tree
                </label>
                <label>
                    <input type="radio" name="coparentType" value="new"> 
                    Create New Person
                </label>
            </div>
            
            <div id="existing-coparent-ui">
                <input type="text" id="coparent-search" 
                       placeholder="Search name..." autocomplete="off">
                <div id="coparent-search-results" class="search-results-dropdown"></div>
                <div id="selected-coparent-display" class="selected-target"></div>
            </div>

            <div id="new-coparent-ui" style="display: none;">
                <input type="text" name="coFirstName" placeholder="First Name">
                <input type="text" name="coLastName" placeholder="Last Name">
                <label>PROFILE UPLINK (AVATAR)</label>
                <input type="file" id="coparent-pic-input" accept="image/*">
            </div>
        </div>
    `;

      // Handle the toggle behavior
      const radios = coParentSection.querySelectorAll(
        'input[name="coparentType"]',
      );
      radios.forEach((r) =>
        r.addEventListener("change", (event) => {
          if (event.target.value === "existing") {
            document.getElementById("existing-coparent-ui").style.display =
              "block";
            document.getElementById("new-coparent-ui").style.display = "none";
          } else {
            document.getElementById("existing-coparent-ui").style.display =
              "none";
            document.getElementById("new-coparent-ui").style.display = "block";
            selectedCoParentId = null; // Clear existing selection
          }
        }),
      );

      // Bind Co-Parent Search
      const coInput = document.getElementById("coparent-search");
      const coResults = document.getElementById("coparent-search-results");
      const coDisplay = document.getElementById("selected-coparent-display");

      coInput.addEventListener("input", (e) => {
        renderSearchResults(
          e.target.value,
          coResults,
          allNodes,
          allEdges,
          (id, name) => {
            selectedCoParentId = id;
            coInput.value = "";
            coResults.innerHTML = "";
            coDisplay.innerHTML = `Partner Locked: <strong>${name}</strong>`;
            formElement.style.display = "block"; // Unlock the form
          },
        );
      });
    }
  });

  // The Graph Transaction (Submit) ---
  formElement.onsubmit = async (e) => {
    e.preventDefault();
    if (!selectedAnchorId) return alert("Please select a target person first.");

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const avatarFile = document.getElementById("profile-pic-input").files[0];
    let avatarBlob = null;

    try {
      // Compress avatar (400px width is plenty for a profile icon)
      if (avatarFile) {
        avatarBlob = await compressImageToBlob(avatarFile, 600, 0.8);
      }
    } catch (compressionError) {
      console.error("Media compression failed:", compressionError);
      alert("Failed to process images. Continuing without media.");
    }

    // --- PRE-FLIGHT: Parent Calculations ---
    let anchorParents = { father: null, mother: null };
    let isFatherGhost = false;
    let isMotherGhost = false;

    // THE GHOST INTERCEPT
    let newRelativeId = crypto.randomUUID(); // Assume new ID by default
    let isUpgradingGhost = false;

    // We now need to check parents for siblings AND when adding a parent
    if (
      data.relationshipType === "sibling" ||
      data.relationshipType === "father" ||
      data.relationshipType === "mother"
    ) {
      anchorParents = await getParentsOfNode(db, selectedAnchorId);
      // 2. Fetch all nodes to inspect their actual properties
      const allNodes = await fetchAllNodes(db);

      // 3. Look up the parent nodes directly
      const fatherNode = allNodes.find((n) => n.id === anchorParents.father);
      const motherNode = allNodes.find((n) => n.id === anchorParents.mother);

      // 4. Verify if they are true ghosts
      isFatherGhost = fatherNode?.isGhost === true;
      isMotherGhost = motherNode?.isGhost === true;
    }

    const tx = db.transaction(["nodes", "edges"], "readwrite");
    const nodeStore = tx.objectStore("nodes");
    const edgeStore = tx.objectStore("edges");

    // --- THE SIBLING LOGIC ---
    if (data.relationshipType === "sibling") {
      let finalFatherId = anchorParents.father;
      let finalMotherId = anchorParents.mother;

      // 1. Generate Ghost Father if missing
      if (!finalFatherId) {
        finalFatherId = crypto.randomUUID();
        nodeStore.put({
          id: finalFatherId,
          firstName: "Father",
          lastName: "Unknown",
          isOrigin: false,
          isGhost: true,
          createdAt: Date.now(),
        });
        edgeStore.put(createEdge(finalFatherId, selectedAnchorId, "father"));
      }

      // 2. Generate Ghost Mother if missing
      if (!finalMotherId) {
        finalMotherId = crypto.randomUUID();
        nodeStore.put({
          id: finalMotherId,
          firstName: "Mother",
          lastName: "Unknown",
          isOrigin: false,
          isGhost: true,
          createdAt: Date.now(),
        });
        edgeStore.put(createEdge(finalMotherId, selectedAnchorId, "mother"));
      }

      // 3. Finally, link the NEW SIBLING to these parents
      edgeStore.put(createEdge(finalFatherId, newRelativeId, "father"));
      edgeStore.put(createEdge(finalMotherId, newRelativeId, "mother"));
    }

    if (
      data.relationshipType === "father" &&
      anchorParents.father &&
      isFatherGhost
    ) {
      newRelativeId = anchorParents.father; // Hijack the ID!
      isUpgradingGhost = true;
    } else if (
      data.relationshipType === "mother" &&
      anchorParents.mother &&
      isMotherGhost
    ) {
      newRelativeId = anchorParents.mother; // Hijack the ID!
      isUpgradingGhost = true;
    }

    // Build the Node using the finalized ID
    const newRelativeNode = {
      id: newRelativeId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      avatar: avatarBlob,
      isOrigin: false,
      isGhost: false, // NEW: This safely overwrites the true flag if we are upgrading a ghost
      createdAt: Date.now(),
    };

    try {
      // 1. Save the new relative stub (this will naturally overwrite the ghost in IndexedDB)
      nodeStore.put(newRelativeNode);

      // 2. Map the structural edges
      if (
        data.relationshipType === "father" ||
        data.relationshipType === "mother"
      ) {
        // NEW: Only draw a new edge if we are NOT upgrading a ghost.
        // If we upgraded a ghost, the edge already exists from when the sibling was created!
        if (!isUpgradingGhost) {
          edgeStore.put(
            createEdge(newRelativeId, selectedAnchorId, data.relationshipType),
          );
        }
      } else if (data.relationshipType === "child") {
        // 1. Dynamically capture the Anchor's role from the UI
        const anchorRole = data.anchorRole; // Will be "father" or "mother"
        const coparentAvatarFile =
          document.getElementById("coparent-pic-input").files[0];
        let coparentAvatarBlob = null;

        try {
          // Compress avatar (400px width is plenty for a profile icon)
          if (coparentAvatarFile) {
            coparentAvatarBlob = await compressImageToBlob(
              coparentAvatarFile,
              600,
              0.8,
            );
          }
        } catch (compressionError) {
          console.error("Media compression failed:", compressionError);
          alert("Failed to process images. Continuing without media.");
        }
        // 2. Mathematically deduce the Co-Parent's role
        const coParentRole = anchorRole === "father" ? "mother" : "father";
        let finalCoParentId = selectedCoParentId; // Note: Ensure selectedCoParentId is defined in your outer scope

        // If they opted to create a NEW partner stub right now
        if (data.coparentType === "new") {
          if (!data.coFirstName || !data.coLastName)
            throw new Error("Missing partner name.");

          finalCoParentId = crypto.randomUUID();
          nodeStore.put({
            id: finalCoParentId,
            firstName: data.coFirstName.trim(),
            lastName: data.coLastName.trim(),
            isOrigin: false,
            avatar: coparentAvatarBlob,
            createdAt: Date.now(),
          });
        }

        if (!finalCoParentId)
          throw new Error("A child must have a designated partner/co-parent.");

        edgeStore.put(createEdge(selectedAnchorId, newRelativeId, anchorRole));
        edgeStore.put(createEdge(finalCoParentId, newRelativeId, coParentRole));
      }

      tx.oncomplete = () => {
        console.log("Graph updated successfully!");
        callback();
      };
    } catch (error) {
      console.error("Transaction failed:", error);
      alert("Error saving to graph: " + error.message);
      tx.abort();
    }
  };
}
