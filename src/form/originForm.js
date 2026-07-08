import { saveNode, saveEdge, savePost } from "../db/db.js";
import { compressImageToBlob } from "./formUtilities.js";

export function renderOriginForm(container, db, callback) {
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
          <label>SPOUSE'S IMAGE (AVATAR)</label>
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
      
      <div class="form-group">
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
        avatarBlob = await compressImageToBlob(avatarFile);
      }

      if (coparentAvatarFile) {
        coAvatarBlob = await compressImageToBlob(coparentAvatarFile);
      }
      // Compress post media (800px width for gallery viewing)
      if (postMediaFile) {
        postMediaBlob = await compressImageToBlob(postMediaFile);
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
