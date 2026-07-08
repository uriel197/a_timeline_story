// Helper function to read the local roster
export const fetchAllNodes = (db) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["nodes"], "readonly");
    const request = tx.objectStore("nodes").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

export const fetchAllEdges = (db) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["edges"], "readonly");
    const request = tx.objectStore("edges").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

export const getParentsOfNode = (db, targetId) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["edges"], "readonly");
    const store = tx.objectStore("edges");
    const request = store.getAll();

    request.onsuccess = () => {
      const allEdges = request.result;
      let parents = { father: null, mother: null };

      // Find edges where the TARGET points TO a parent
      // Note: In our previous code, parent->child edges were structured as `from: Parent, to: Child`
      // So we are looking for edges where `to === targetId`
      allEdges.forEach((edge) => {
        if (edge.to === targetId && edge.type === "father")
          parents.father = edge.from;
        if (edge.to === targetId && edge.type === "mother")
          parents.mother = edge.from;
      });

      resolve(parents);
    };
    request.onerror = (e) => reject(e.target.error);
  });
};

export const createEdge = (fromId, toId, type) => {
  return {
    id: `edge_${crypto.randomUUID()}`,
    from: fromId,
    to: toId,
    type: type,
  };
};
