import { renderSearchResults } from "../formUtilities.js";

export class PersonSearch {
  constructor(container, allNodes, allEdges, onSelectCallback) {
    this.container = container;
    this.allNodes = allNodes;
    this.allEdges = allEdges;
    this.onSelect = onSelectCallback;
    this.input = null;
    this.resultsContainer = null;
    this._init();
  }

  _init() {
    this.container.innerHTML = `
      <label>Search Person</label>
      <input type="text" id="person-search-input" placeholder="Search by name..." autocomplete="off">
      <div id="search-results-dropdown"></div>
    `;

    this.input = this.container.querySelector("#person-search-input");
    this.resultsContainer = this.container.querySelector(
      "#search-results-dropdown",
    );

    this.input.addEventListener("input", (e) => {
      renderSearchResults(
        e.target.value,
        this.resultsContainer,
        this.allNodes,
        this.allEdges,
        (id, name) => {
          this.onSelect(id, name);
          this.input.value = "";
          this.resultsContainer.innerHTML = "";
        },
      );
    });

    // Close results when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.container.contains(e.target)) {
        this.resultsContainer.innerHTML = "";
      }
    });
  }

  setPlaceholder(text) {
    if (this.input) this.input.placeholder = text;
  }

  clear() {
    if (this.input) this.input.value = "";
    if (this.resultsContainer) this.resultsContainer.innerHTML = "";
  }
}
