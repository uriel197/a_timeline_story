import { saveNode } from "../db/db.js";
import {
  fetchAllNodes,
  fetchAllEdges,
  getParentsOfNode,
  createEdge,
} from "../db/db_logic/utilityFunctions.js";
import { compressImageToBlob, renderSearchResults } from "./formUtilities.js";
import { CoParentSection } from "../form/components/CoParentSection.js";

export async function renderAddRelativeForm(
  container,
  db,
  callback,
  initialActive = null,
) {
  // 1. Fetch all people once for lightning-fast memory filtering
  const allNodes = await fetchAllNodes(db);
  const allEdges = await fetchAllEdges(db);

  // State variables for the form
  let selectedAnchor = initialActive;
  let selectedCoParentId;
  let coParentSection = null;

  container.innerHTML = `
    <div class="form-panel">     
      <div class="target-section">
        <div id="selected-anchor-display" class="selected-target"></div>
      </div>

      <form id="add-relative-form" class="relative-form">
        <div class="form-group">
          <label>HOW IS THIS NEW ADDITION RELATED TO YOU</label>
          <select name="relationshipType" id="relationship-type" required>
            <option value="">-- SELECT --</option>
            <option value="father">FATHER</option>
            <option value="mother">MOTHER</option>
            <option value="sibling">SIBLING</option>
            <option value="child">CHILD</option>
            </select>
        </div>

        <div id="anchor-role-container" class="anchorRoleContainer">
            <label>WHAT IS YOUR ROLE TO THIS CHILD?</label>
            <select name="anchorRole" id="anchor-role" class="anchorRole">
                <option value="father">Father</option>
                <option value="mother">Mother</option>
            </select>
        </div>

        <div class="form-group">
          <label>RELATIVE'S FIRST NAME</label>
          <input type="text" name="firstName" required>
        </div>

        <div class="form-group">
          <label>RELATIVE'S LAST NAME</label>
          <input type="text" name="lastName" required>
        </div>

        <div class="form-group">
          <label>PROFILE UPLINK (AVATAR)</label>
          <input type="file" id="profile-pic-input" accept="image/*">
        </div>
      
        <div id="dynamic-coparent-section"></div>
        <div class="btn-container">
            <button type="submit" class="btn-save">Save to DataBase</button>
            <button type="button" id="cancel-post">CANCEL</button>
        </div>
      </form>
    </div>
  `;

  // --- DOM Elements ---

  const anchorDisplay = container.querySelector("#selected-anchor-display");
  const formElement = container.querySelector("#add-relative-form");
  const relationSelect = container.querySelector("#relationship-type");
  const anchorRoleContainer = container.querySelector("#anchor-role-container");
  const dynamicCoParentSection = container.querySelector(
    "#dynamic-coparent-section",
  );

  container.querySelector("#cancel-post").onclick = () => {
    callback(); // go back
  };

  anchorDisplay.innerHTML = `Adding relative to: <strong>${selectedAnchor.firstName}</strong>`;

  // Dynamic Co-Parent Logic for "Child" ---
  relationSelect.addEventListener("change", (e) => {
    const type = e.target.value;
    anchorRoleContainer.style.display = "none";
    dynamicCoParentSection.innerHTML = "";

    if (type === "child") {
      anchorRoleContainer.style.display = "block";
      coParentSection = new CoParentSection(
        dynamicCoParentSection,
        allNodes,
        allEdges,
        (id, name) => {
          selectedCoParentId = id;
        },
      );
    } else {
      coParentSection = null;
    }
  });

  // The Graph Transaction (Submit) ---
  formElement.onsubmit = async (e) => {
    e.preventDefault();
    // if (!selectedAnchorId) return alert("Please select a target person first.");

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const avatarFile = document.getElementById("profile-pic-input").files[0];
    let avatarBlob = null;

    try {
      // Compress avatar (400px width is plenty for a profile icon)
      if (avatarFile) {
        avatarBlob = await compressImageToBlob(avatarFile);
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
      anchorParents = await getParentsOfNode(db, selectedAnchor.id);
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
        edgeStore.put(createEdge(finalFatherId, selectedAnchor.id, "father"));
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
        edgeStore.put(createEdge(finalMotherId, selectedAnchor.id, "mother"));
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
            createEdge(newRelativeId, selectedAnchor.id, data.relationshipType),
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
            coparentAvatarBlob = await compressImageToBlob(coparentAvatarFile);
          }
        } catch (compressionError) {
          console.error("Media compression failed:", compressionError);
          alert("Failed to process images. Continuing without media.");
        }
        // 2. Mathematically deduce the Co-Parent's role
        const coParentRole = anchorRole === "father" ? "mother" : "father";
        let finalCoParentId = selectedCoParentId;

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

        edgeStore.put(createEdge(selectedAnchor.id, newRelativeId, anchorRole));
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
