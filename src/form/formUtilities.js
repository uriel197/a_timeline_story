/**
 * Intercepts an image File, shrinks it via Canvas, and returns a compressed Blob.
 * @param {File} file - The raw image file from an <input type="file">
 * @param {number} maxWidth - Max width in pixels (keeps UI snappy)
 * @param {number} quality - 0.0 to 1.0 compression ratio
 */

export const compressImageToBlob = (file, maxWidth = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        // Create an invisible canvas
        const canvas = document.createElement("canvas");

        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw the image onto the canvas at the new size
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Export the canvas as a compressed WebP Blob
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas compression failed"));
          },
          "image/webp", // WebP format is perfectly suited for fast DB storage
          quality,
        );
      };
      img.onerror = (e) =>
        reject(new Error("Failed to load image into canvas"));
    };
    reader.onerror = (e) => reject(new Error("Failed to read file"));
  });
};

export function renderSearchResults(
  query,
  resultsContainer,
  allNodes,
  allEdges,
  onSelect,
) {
  if (!query) {
    resultsContainer.innerHTML = "";
    return;
  }
  const filtered = allNodes
    .filter((node) =>
      `${node.firstName} ${node.lastName}`
        .toLowerCase()
        .startsWith(query.toLowerCase()),
    )
    .slice(0, 5); // Limit to top 5 results

  resultsContainer.innerHTML = filtered
    .map((node) => {
      let contextTags = [];

      // Find ALL edges for this person instead of just the first one
      // to give a richer context if they have multiple connections!
      const matchingEdges = allEdges.filter(
        (edge) => edge.from === node.id || edge.to === node.id,
      );

      matchingEdges.forEach((edge) => {
        const isFromMe = edge.from === node.id;
        const targetId = isFromMe ? edge.to : edge.from;
        const relativeNode = allNodes.find((n) => n.id === targetId);

        if (!relativeNode) return;

        // 1. HANDLE SPOUSE / PARTNER RELATIONSHIPS (Lateral Edges)
        if (["spouse", "partner", "ex-spouse"].includes(edge.type)) {
          const role =
            edge.type === "spouse"
              ? "Spouse"
              : edge.type === "ex-spouse"
                ? "Ex-spouse"
                : "Partner";

          contextTags.push(
            `${role} of: ${relativeNode.firstName} ${relativeNode.lastName}`,
          );
        }
        // 2. HANDLE PARENT/CHILD RELATIONSHIPS (Hierarchical Edges)
        else if (edge.type === "father" || edge.type === "mother") {
          if (isFromMe) {
            // Vector points away: This node is the parent
            const role = edge.type.charAt(0).toUpperCase() + edge.type.slice(1);

            contextTags.push(
              `${role} of: ${relativeNode.firstName} ${relativeNode.lastName}`,
            );
          } else {
            // Vector points toward: This node is the child
            contextTags.push(
              `Child of: ${relativeNode.firstName} ${relativeNode.lastName}`,
            );
          }
        }
      });

      return `
      <div class="search-item" data-id="${node.id}" style="cursor: pointer; padding: 8px; border-bottom: 1px solid #333;">
        <div class="search-name" style="font-weight: bold; font-size: 1.1em;">${node.firstName} ${node.lastName}</div>
        <div class="search-context" style="font-size: 0.8em; color: #888; margin-top: 2px;">
            ${contextTags.length ? contextTags[0] : "Standalone Node"}
        </div>
      </div>
    `;
    })
    .join("");

  resultsContainer.querySelectorAll(".search-item").forEach((item) => {
    item.addEventListener("click", () =>
      onSelect(item.dataset.id, item.innerText),
    );
  });
}
