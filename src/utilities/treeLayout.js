export function calculateTreeLayout(anchorId, nodes, edges) {
  const treeMap = []; // This will store {tier: 0, node: {...}}

  // 1. Recursive helper to find ancestors
  function findAncestors(nodeId, tier) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Add to map
    treeMap.push({ tier, node });

    // Find parents
    const parentEdges = edges.filter((e) => e.to === nodeId);
    parentEdges.forEach((edge) => {
      // Recurse to the next tier
      findAncestors(edge.from, tier + 1);
    });
  }

  // 2. Start the engine
  findAncestors(anchorId, 0);

  // 3. Group by tier for the DOM
  return treeMap.reduce((acc, item) => {
    acc[item.tier] = acc[item.tier] || [];
    acc[item.tier].push(item.node);
    return acc;
  }, {});
}
