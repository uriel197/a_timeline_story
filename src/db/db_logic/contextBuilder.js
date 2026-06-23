import { getOriginNode } from "../db.js";
import {
  fetchAllNodes,
  fetchAllEdges,
  getParentsOfNode,
} from "../../utilities/utilityFunctions.js";

// ==========================================
// THE PARENT TIMELINE CONTEXT
// ==========================================
export const buildParentTimelineContext = async (db, parentIds) => {
  const allNodes = await fetchAllNodes(db);

  // 1. Resolve raw IDs from edges into full, rich profile objects
  const fatherNode = allNodes.find((n) => n.id === parentIds.father);
  const motherNode = allNodes.find((n) => n.id === parentIds.mother);

  // 2. Filter out null entries safely if a parent profile doesn't exist yet
  const parentNodes = [fatherNode, motherNode].filter(Boolean);
  console.log(parentNodes);

  // 3. Look up the grandparents using the first available parent node
  // so the zoomBack track stays perfectly intact for subsequent ascends!
  let grandParentIds = { father: null, mother: null };
  if (parentNodes.length > 0) {
    grandParentIds = await getParentsOfNode(db, parentNodes[0].id);
  }

  return {
    timelineId: `parents_${parentIds.father || "unknown"}_${parentIds.mother || "unknown"}`,
    timelineType: "PARENTS",
    points: parentNodes.length + 1, // Correctly creates segments for the parent profiles
    startIndex: 0, // Defaults view target onto the Father node
    parentIds: grandParentIds, // Stashed breadcrumbs for climbing to grandparents
    nodes: parentNodes, // Segment 0 = Father, Segment 1 = Mother
  };
};

// ==========================================
// 1. THE SIBLING CONTEXT (Horizontal Generation)
// ==========================================
export const buildSiblingContext = async (db, targetId) => {
  const allEdges = await fetchAllEdges(db);
  const allNodes = await fetchAllNodes(db);

  // 1. Find Parents of the Target
  const parents = await getParentsOfNode(db, targetId);

  let siblingIds = new Set();

  if (parents.father || parents.mother) {
    const fatherChildren = allEdges
      .filter((e) => e.from === parents.father && e.type === "father")
      .map((e) => e.to);

    const motherChildren = allEdges
      .filter((e) => e.from === parents.mother && e.type === "mother")
      .map((e) => e.to);

    if (parents.father && parents.mother) {
      siblingIds = new Set(
        fatherChildren.filter((id) => motherChildren.includes(id)),
      );
    } else {
      const activeList = parents.mother ? motherChildren : fatherChildren;
      siblingIds = new Set(activeList);
    }
  }

  // If no parents exist, they are the only node in this generation
  if (siblingIds.size === 0) {
    siblingIds.add(targetId);
  }

  const siblingNodes = Array.from(siblingIds)
    .map((id) => allNodes.find((n) => n.id === id))
    .filter(Boolean)
    .sort((a, b) => a.createdAt - b.createdAt);

  const targetIndex = siblingNodes.findIndex((n) => n.id === targetId);

  return {
    timelineId: `gen_siblings_${targetId}`,
    timelineType: "SIBLINGS",
    points: siblingNodes.length + 1,
    startIndex: targetIndex !== -1 ? targetIndex : 0,
    parentIds: parents, // Pre-computed for zooming back!
    nodes: siblingNodes,
  };
};

// ==========================================
// 1a. THE ORIGIN BOOT WRAPPER
// ==========================================
export const buildOriginContext = async (db) => {
  const origin = await getOriginNode(db);
  if (!origin) throw new Error("No Origin node found in the database.");

  // The Origin timeline is simply the Sibling Context of the Origin user
  return await buildSiblingContext(db, origin.id);
};

// ==========================================
// 2. THE CHILD CONTEXT (Dive Deeper / Down)
// ==========================================
export const buildChildContext = async (
  db,
  targetParentId,
  coParentId = null,
) => {
  const allEdges = await fetchAllEdges(db);
  const allNodes = await fetchAllNodes(db);

  // 1. Find all children of the primary target
  const primaryChildrenIds = allEdges
    .filter(
      (edge) =>
        edge.from === targetParentId &&
        (edge.type === "father" || edge.type === "mother"),
    )
    .map((edge) => edge.to);

  let finalChildIds = primaryChildrenIds;

  // 2. If we have a co-parent, filter for only the SHARED children (Intersection)
  if (coParentId) {
    const coParentChildrenIds = allEdges
      .filter((edge) => edge.from === coParentId)
      .map((edge) => edge.to);

    finalChildIds = primaryChildrenIds.filter((id) =>
      coParentChildrenIds.includes(id),
    );
  }

  // Deduplicate IDs just to be safe
  finalChildIds = [...new Set(finalChildIds)];

  // 3. Map to Node data and sort naturally
  const childNodes = finalChildIds
    .map((id) => allNodes.find((n) => n.id === id))
    .filter(Boolean) /* 1 */
    .sort((a, b) => a.createdAt - b.createdAt);

  // 4. Package the parent mapping of the first shared child for the Zoom Back trajectory
  let parentIds = { father: null, mother: null };
  if (childNodes.length > 0) {
    parentIds = await getParentsOfNode(db, childNodes[0].id);
  }

  return {
    // Unique ID combining both parents so the engine knows exactly which family unit this is
    timelineId: `gen_children_${targetParentId}_${coParentId || "all"}`,
    timelineType: "SIBLINGS",
    points: childNodes.length + 1,
    startIndex: 0,
    parentIds,
    nodes: childNodes,
  };
};

/*********************** EXPLANATIONS ********************

/* 1 */ /*
.map(...)
For every id in finalChildIds, it looks up the full node object using allNodes.find(...).If the node is found → returns the node object (truthy).
If the node is NOT found → find() returns undefined (falsy).

So after .map(), you might have something like:js

[ {id: "123", ...}, undefined, {id: "456", ...}, undefined ]

.filter(Boolean)
This removes all undefined (and any other falsy values like null, false, 0, "", etc.).Boolean is a function. When passed to filter(), it acts as a filter predicate.

*/

// export const buildOriginContext = async (db) => {
//   // 1. Find the Origin Node
//   const origin = await getOriginNode(db);
//   if (!origin) throw new Error("No Origin node found in the database.");

//   // 2. Find Origin's Parents
//   const parents = await getParentsOfNode(db, origin.id);

//   // 3. Find all Children of those Parents (The Sibling Array)
//   const allEdges = await fetchAllEdges(db);
//   const allNodes = await fetchAllNodes(db);

//   let siblingIds = new Set();

//   if (parents.father || parents.mother) {
//     // Isolate edges pointing AWAY from the parents to children
//     const fatherChildren = allEdges
//       .filter((e) => e.from === parents.father && e.type === "father")
//       .map((e) => e.to);

//     const motherChildren = allEdges
//       .filter((e) => e.from === parents.mother && e.type === "mother")
//       .map((e) => e.to);

//     // To get FULL siblings, we want the intersection (children sharing BOTH parents).
//     // If a parent is missing (null), we just use the active parent's children.
//     if (parents.father && parents.mother) {
//       siblingIds = new Set(
//         motherChildren.filter((id) => fatherChildren.includes(id)),
//       );
//     } else {
//       const activeList = parents.mother ? motherChildren : fatherChildren;
//       siblingIds = new Set(activeList);
//     }
//   }

//   // If the Origin has no parents yet, they are an only child in their own generation
//   if (siblingIds.size === 0) {
//     siblingIds.add(origin.id);
//   }

//   // 4. Map IDs back to Node data, sorted naturally by creation time
//   const siblingNodes = Array.from(siblingIds)
//     .map((id) => allNodes.find((n) => n.id === id))
//     .filter(Boolean)
//     .sort((a, b) => a.createdAt - b.createdAt);

//   // 5. Calculate the exact index for the Camera to snap to
//   const originIndex = siblingNodes.findIndex((n) => n.id === origin.id);

//   // 6. Return the Context Payload
//   return {
//     timelineId: `gen_${origin.id}`, // Unique ID for this specific timeline layer
//     points: siblingNodes.length,
//     startIndex: originIndex !== -1 ? originIndex : 0, // Auto-focus target
//     parentIds: parents,
//     nodes: siblingNodes, // The rich data for the UI Overlay
//   };
// };
