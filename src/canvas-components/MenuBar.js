// ui/components/MenuBar.js
export class MenuBar {
  constructor(overlayManager, currentUser) {
    this.overlayManager = overlayManager;
    this.currentUser = currentUser;
  }

  render(container) {
    container.innerHTML = `
      <div class="menu-bar tactical-menu" id="menu-bar-container" style="display: none;">
        <button class="menu-btn" id="edit-person-btn">
          [ EDIT PERSON ]
        </button>
        <button class="menu-btn" id="add-post-btn">
          [ ADD POST ]
        </button>
        <button class="menu-btn" id="add-relative-btn">
          [ ADD RELATIVE ]
        </button>
      </div>
    `;

    // Bind buttons
    const menuBarCont = document.getElementById("menu-bar-container");
    if (!this.currentUser.isVerified) menuBarCont.style.display = "flex";

    container.querySelector("#edit-person-btn").onclick = () =>
      this.overlayManager.openEditForm(this.currentUser);

    container.querySelector("#add-post-btn").onclick = () =>
      this.overlayManager.openPostCreator(this.currentUser);

    container.querySelector("#add-relative-btn").onclick = () =>
      this.overlayManager.openAddRelativeForm(this.currentUser);
  }

  destroy(container) {
    if (container) container.innerHTML = "";
  }
}
