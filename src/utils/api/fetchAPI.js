import { TimelineRegistry } from "./registry.js";

export async function fetchFromAPI(node) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockData = [
        {
          id: "root",
          parentId: null,
          currentLevel: 0,
          points: [5],
        },
        {
          id: "root/1",
          parentId: "root",
          currentLevel: 1,
          points: [4, 5, 3, 4],
        },
        {
          id: "root/2",
          parentId: "root/1",
          currentLevel: 2,
          points: [
            [2, 3, 5],
            [4, 8, 5, 10],
            [2, 8],
            [4, 7, 5],
          ],
        },
      ];

      mockData.forEach((block) => {
        TimelineRegistry.cache.set(block.currentLevel, block);
      });

      const currentNodeData = TimelineRegistry.cache.get(node.currentLevel);

      if (currentNodeData) {
        const points = currentNodeData.points[0];

        node.data = {
          ...currentNodeData,
          points,
        };
        //node.isLoaded = true;
        resolve(currentNodeData); // Success!
      } else {
        console.error(`Node ${node.currentLevel} not found in API`);
        resolve(null);
      }
    }, 100);
  });
}
