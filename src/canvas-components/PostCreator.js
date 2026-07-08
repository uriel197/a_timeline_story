// ui/components/PostCreator.js
import { savePost } from "../db/db.js";
import { compressImageToBlob } from "../form/formUtilities.js";

export class PostCreator {
  constructor(container, db, person, onPostSaved) {
    this.container = container;
    this.db = db;
    this.person = person;
    this.onPostSaved = onPostSaved;
    this._init();
  }

  _init() {
    this.container.innerHTML = `
      <div class="form-panel">
        <div class="title-bar">ADD NEW POST // ${this.person.firstName}</div>
        
        <form id="post-creator-form" class="relative-form">
          <div class="form-group">
            <label>POST CONTENT</label>
            <textarea id="post-text" rows="5" placeholder="Write a new secure log entry..." required></textarea>
          </div>
          
          <div class="form-group">
            <label>ATTACH MEDIA (OPTIONAL)</label>
            <input type="file" id="post-media-input" accept="image/*">
          </div>

          <div class="btn-container">
            <button type="submit" class="btn-save">POST TO LOG</button>
            <button type="button" id="cancel-post">CANCEL</button>
          </div>
        </form>
      </div>
    `;

    const form = this.container.querySelector("#post-creator-form");

    form.onsubmit = async (e) => {
      e.preventDefault();

      const text = this.container.querySelector("#post-text").value.trim();
      const mediaFile =
        this.container.querySelector("#post-media-input").files[0];

      let mediaBlob = null;
      if (mediaFile) {
        try {
          mediaBlob = await compressImageToBlob(mediaFile, 800, 0.8);
        } catch (err) {
          console.error("Media compression failed:", err);
        }
      }

      if (!text && !mediaBlob) {
        alert("Post must contain text or media.");
        return;
      }

      const newPost = {
        id: `post_${crypto.randomUUID()}`,
        authorId: this.person.id,
        timestamp: Date.now(),
        textContent: text,
        mediaAttached: mediaBlob,
      };

      try {
        await savePost(this.db, newPost);
        alert("Post added successfully.");
        if (this.onPostSaved) this.onPostSaved();
      } catch (err) {
        alert("Failed to save post.");
        console.error(err);
      }
    };

    this.container.querySelector("#cancel-post").onclick = () => {
      if (this.onPostSaved) this.onPostSaved(); // go back
    };
  }
}
