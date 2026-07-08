import { PersonSearch } from "./PersonSearch.js";

export class CoParentSection {
  constructor(container, allNodes, allEdges, onCoParentSelected) {
    this.container = container;
    this.allNodes = allNodes;
    this.allEdges = allEdges;
    this.onCoParentSelected = onCoParentSelected;
    this.selectedCoParentId = null;
    this._init();
  }

  _init() {
    this.container.innerHTML = `
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
          <!-- PersonSearch will be mounted here -->
        </div>

        <div id="new-coparent-ui" style="display: none;">
          <input type="text" name="coFirstName" placeholder="First Name">
          <input type="text" name="coLastName" placeholder="Last Name">
          <label>PROFILE UPLINK (AVATAR)</label>
          <input type="file" id="coparent-pic-input" accept="image/*">
        </div>
      </div>
    `;

    this.existingUI = this.container.querySelector("#existing-coparent-ui");
    this.newUI = this.container.querySelector("#new-coparent-ui");
    this.radios = this.container.querySelectorAll('input[name="coparentType"]');

    // Mount PersonSearch for existing co-parent
    const searchContainer = document.createElement("div");
    this.existingUI.appendChild(searchContainer);

    this.personSearch = new PersonSearch(
      searchContainer,
      this.allNodes,
      this.allEdges,
      (id, name) => {
        this.selectedCoParentId = id;
        this.onCoParentSelected(id, name);
      },
    );

    // Toggle between existing / new
    this.radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.value === "existing") {
          this.existingUI.style.display = "block";
          this.newUI.style.display = "none";
        } else {
          this.existingUI.style.display = "none";
          this.newUI.style.display = "block";
          this.selectedCoParentId = null;
        }
      });
    });
  }

  getSelectedCoParentId() {
    return this.selectedCoParentId;
  }

  getNewCoParentData() {
    return {
      firstName: this.container
        .querySelector('[name="coFirstName"]')
        ?.value?.trim(),
      lastName: this.container
        .querySelector('[name="coLastName"]')
        ?.value?.trim(),
      avatarFile: this.container.querySelector("#coparent-pic-input")?.files[0],
    };
  }

  clear() {
    this.selectedCoParentId = null;
    if (this.personSearch) this.personSearch.clear();
  }
}
