import { TimelineRegistry } from "../registry";
import { getNestedValue } from "../utilityFunctions";

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
        TimelineRegistry.cache.set(block.id, block);
      });

      const currentNodeData = TimelineRegistry.cache.get(node.id);

      if (currentNodeData) {
        const points = getNestedValue(currentNodeData.points);

        node.data = {
          ...currentNodeData,
          points,
        };
        node.isLoaded = true;
        resolve(currentNodeData); // Success!
      } else {
        console.error(`Node ${node.id} not found in API`);
        resolve(null);
      }
    }, 100);
  });
}

//   segments: [
//     {
//       backgroundUrl:
//         "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200",
//     },
//     {
//       backgroundUrl:
//         "https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=1200",
//     },
//     { backgroundUrl: "https://picsum.photos/1200/800?random=3" },
//     { backgroundUrl: "https://picsum.photos/1200/800?random=4" },
//   ],
