export const initDB = () => {
  return new Promise((resolve, reject) => {
    // IMPORTANT: Bumped version to 2 to trigger the upgrade
    const request = indexedDB.open("TimelineEngineDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Defensive check: Only create if they don't exist
      if (!db.objectStoreNames.contains("nodes")) {
        db.createObjectStore("nodes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("edges")) {
        db.createObjectStore("edges", { keyPath: "id" });
      }

      // NEW: Secure Comms / Posts Store
      if (!db.objectStoreNames.contains("posts")) {
        const postStore = db.createObjectStore("posts", { keyPath: "id" });
        // Create an index to quickly query posts by who wrote them
        postStore.createIndex("authorId", "authorId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

export const saveNode = (db, personNode) => {
  return new Promise((resolve, reject) => {
    // Open a readwrite transaction strictly on the "nodes" store
    const tx = db.transaction(["nodes"], "readwrite");
    const store = tx.objectStore("nodes");

    const request = store.put(personNode);

    request.onsuccess = () => resolve(personNode);
    request.onerror = (e) => reject(e.target.error);
  });
};

export const getOriginNode = (db) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["nodes"], "readonly");
    const store = tx.objectStore("nodes");
    const request = store.getAll(); // Fetch everyone

    request.onsuccess = () => {
      const allNodes = request.result;
      // Search the array for the single user marked as the Origin
      const originNode = allNodes.find((node) => node.isOrigin === true);

      // If found, returns the profile object; if empty tree, returns undefined
      resolve(originNode);
    };

    request.onerror = (e) => reject(e.target.error);
  });
};

// Add this to your db.js (wherever saveNode lives)
export const saveEdge = async (db, edgeObject) => {
  return new Promise((resolve, reject) => {
    // Make sure "edges" matches the actual name of your Edge objectStore!
    const transaction = db.transaction(["edges"], "readwrite");
    const store = transaction.objectStore("edges");

    const request = store.add(edgeObject); // or store.put(edgeObject)

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Save a post to the database
export const savePost = (db, postObject) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["posts"], "readwrite");
    const store = tx.objectStore("posts");

    const request = store.put(postObject);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Fetch all posts for a specific user ID
export const getPostsByAuthor = (db, authorId) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["posts"], "readonly");
    const store = tx.objectStore("posts");
    const index = store.index("authorId");

    // Query the index directly for lightning-fast lookups
    const request = index.getAll(authorId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};
