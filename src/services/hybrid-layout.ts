/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphNode, GraphEdge, SubsystemId } from '../types/graph.ts';

export interface LayoutNode {
  id: string;
  name: string;
  type: string;
  subsystem: SubsystemId;
  x: number;
  y: number;
  tier: number;
  column: number;
  degree: number;
  collapsed: boolean;
  visible: boolean;
}

export interface LayoutEdge {
  id: string;
  src: string;
  dst: string;
  type: string;
  claim: string;
  status: string;
  isLayered: boolean; // true for part_of & contains
  visible: boolean;
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  visibleCount: { nodes: number; edges: number };
}

const SUBSYSTEM_ORDER: SubsystemId[] = [
  'sys-drivetrain',
  'sys-wheels',
  'sys-cockpit',
  'sys-brakes',
];

export function getNodeSubsystem(node: GraphNode): SubsystemId {
  if (node.type === 'subsystem') return node.id as SubsystemId;
  return (node.subsystem || 'sys-drivetrain') as SubsystemId;
}

/**
 * Checks if an edge is a hierarchical/layered edge
 */
export function isLayeredEdge(edgeType: string): boolean {
  return edgeType === 'contains' || edgeType === 'part_of';
}

/**
 * Assigns tier based on node type and structural role
 */
function getNodeTier(node: GraphNode): number {
  if (node.type === 'subsystem') return 0;
  if (
    node.id === 'comp-rear-hub' ||
    node.id === 'comp-headset' ||
    node.id === 'comp-fork' ||
    node.id === 'comp-disc-brake-caliper' ||
    node.id === 'comp-bb-threaded'
  ) {
    return 1;
  }
  if (node.type === 'component' || node.type === 'subcomponent') return 2;
  // standards, properties, diagnostic, unknown
  return 3;
}

/**
 * Calculates node degree across all edges
 */
export function computeDegrees(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const n of nodes) {
    degrees.set(n.id, 0);
  }
  for (const e of edges) {
    degrees.set(e.src, (degrees.get(e.src) || 0) + 1);
    degrees.set(e.dst, (degrees.get(e.dst) || 0) + 1);
  }
  return degrees;
}

/**
 * Hybrid Layout Engine:
 * - Hierarchical / layered placement for structural containment (contains, part_of, subsystem tiers)
 * - Lateral spring force relaxation for cross-links (fits, interfaces_with, requires, incompatible_with, conforms_to)
 * - Auto-collapse for degree > threshold (spec defines degree > 40)
 * - Depth-bounded filtering around selected focus node
 */
export function calculateHybridLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    selectedNodeId?: string | null;
    depthLimit?: number; // 1 to 4
    resultLimit?: number; // 1 to 27
    searchQuery?: string;
    subsystemFilter?: SubsystemId | 'all';
    typeFilter?: string | 'all';
    degreeCollapseThreshold?: number; // default 40
    collapsedNodes?: Set<string>;
  } = {}
): LayoutResult {
  const {
    selectedNodeId = null,
    depthLimit = 4,
    resultLimit = 27,
    searchQuery = '',
    subsystemFilter = 'all',
    typeFilter = 'all',
    degreeCollapseThreshold = 40,
    collapsedNodes = new Set<string>(),
  } = options;

  const degrees = computeDegrees(nodes, edges);

  // 1. Determine graph connectivity for depth filtering if selectedNodeId is present
  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n.id, new Set());
  for (const e of edges) {
    adjacency.get(e.src)?.add(e.dst);
    adjacency.get(e.dst)?.add(e.src);
  }

  const distances = new Map<string, number>();
  if (selectedNodeId && nodes.some((n) => n.id === selectedNodeId)) {
    const queue: [string, number][] = [[selectedNodeId, 0]];
    distances.set(selectedNodeId, 0);
    while (queue.length > 0) {
      const [curr, dist] = queue.shift()!;
      if (dist < depthLimit) {
        for (const neighbor of adjacency.get(curr) || []) {
          if (!distances.has(neighbor)) {
            distances.set(neighbor, dist + 1);
            queue.push([neighbor, dist + 1]);
          }
        }
      }
    }
  }

  // 2. Filter nodes based on search, subsystem, type, and depth
  const visibleNodeMap = new Map<string, boolean>();
  const query = searchQuery.trim().toLowerCase();

  for (const node of nodes) {
    let isVisible = true;
    const nodeSub = getNodeSubsystem(node);

    // Search filter
    if (query) {
      const matchesSearch =
        node.id.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        nodeSub.toLowerCase().includes(query);
      if (!matchesSearch) isVisible = false;
    }

    // Subsystem filter
    if (subsystemFilter !== 'all' && nodeSub !== subsystemFilter) {
      isVisible = false;
    }

    // Type filter
    if (typeFilter !== 'all' && node.type !== typeFilter) {
      isVisible = false;
    }

    // Depth filter (only applied if selectedNodeId is set and depthLimit is restrictive)
    if (selectedNodeId && depthLimit < 4) {
      const dist = distances.get(node.id);
      if (dist === undefined || dist > depthLimit) {
        isVisible = false;
      }
    }

    visibleNodeMap.set(node.id, isVisible);
  }

  // 3. Degree auto-collapse & explicit collapse enforcement (Guardrail 4)
  const collapsedHubIds = new Set<string>();
  for (const node of nodes) {
    const deg = degrees.get(node.id) || 0;
    if (deg > degreeCollapseThreshold || collapsedNodes.has(node.id)) {
      collapsedHubIds.add(node.id);
    }
  }

  if (collapsedHubIds.size > 0) {
    for (const hubId of collapsedHubIds) {
      for (const edge of edges) {
        if (edge.src === hubId && edge.dst !== selectedNodeId) {
          visibleNodeMap.set(edge.dst, false);
        }
      }
    }
  }

  // 4. Result Count Limit enforcement (Guardrail 4)
  if (resultLimit !== undefined && resultLimit < nodes.length) {
    const candidateNodes = nodes.filter((n) => visibleNodeMap.get(n.id));
    if (candidateNodes.length > resultLimit) {
      candidateNodes.sort((a, b) => {
        if (a.id === selectedNodeId) return -1;
        if (b.id === selectedNodeId) return 1;
        const distA = distances.get(a.id) ?? 999;
        const distB = distances.get(b.id) ?? 999;
        if (distA !== distB) return distA - distB;
        const degA = degrees.get(a.id) || 0;
        const degB = degrees.get(b.id) || 0;
        if (degA !== degB) return degB - degA;
        return a.id.localeCompare(b.id);
      });

      const allowedIds = new Set(candidateNodes.slice(0, resultLimit).map((n) => n.id));
      for (const node of nodes) {
        if (!allowedIds.has(node.id)) {
          visibleNodeMap.set(node.id, false);
        }
      }
    }
  }

  // 5. Hierarchical base grid assignment
  const layoutNodes = new Map<string, LayoutNode>();
  const COLUMN_WIDTH = 340;
  const TIER_HEIGHT = 160;
  const CANVAS_PADDING_X = 80;
  const CANVAS_PADDING_Y = 80;

  // Track nodes per (subsystem, tier) to space them horizontally
  const tierBucket = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const nodeSub = getNodeSubsystem(node);
    let colIdx = SUBSYSTEM_ORDER.indexOf(nodeSub);
    if (colIdx < 0) colIdx = 0;
    const tier = getNodeTier(node);
    const key = `${colIdx}_${tier}`;
    if (!tierBucket.has(key)) tierBucket.set(key, []);
    tierBucket.get(key)!.push(node);
  }

  for (const [key, bucketNodes] of tierBucket.entries()) {
    const [colStr, tierStr] = key.split('_');
    const colIdx = parseInt(colStr, 10);
    const tier = parseInt(tierStr, 10);

    const count = bucketNodes.length;
    const colCenterX = CANVAS_PADDING_X + colIdx * COLUMN_WIDTH + COLUMN_WIDTH / 2;
    const tierCenterY = CANVAS_PADDING_Y + tier * TIER_HEIGHT + 40;

    bucketNodes.forEach((node, idx) => {
      // Space nodes within column bucket
      const offset = (idx - (count - 1) / 2) * 135;
      const deg = degrees.get(node.id) || 0;
      const isAutoCollapsed = deg > degreeCollapseThreshold || collapsedNodes.has(node.id);
      const nodeSub = getNodeSubsystem(node);

      layoutNodes.set(node.id, {
        id: node.id,
        name: node.name,
        type: node.type,
        subsystem: nodeSub,
        x: colCenterX + offset,
        y: tierCenterY,
        tier,
        column: colIdx,
        degree: deg,
        collapsed: isAutoCollapsed,
        visible: visibleNodeMap.get(node.id) ?? true,
      });
    });
  }

  // 4. Force relaxation for cross-links:
  // Cross-link edges gently pull connected nodes along X without breaking tier stratification
  const crossEdges = edges.filter((e) => !isLayeredEdge(e.type));
  const iterations = 25;
  const springStrength = 0.05;

  for (let iter = 0; iter < iterations; iter++) {
    // Spring attraction along X for cross-links
    for (const edge of crossEdges) {
      const src = layoutNodes.get(edge.src);
      const dst = layoutNodes.get(edge.dst);
      if (src && dst && src.visible && dst.visible) {
        const dx = dst.x - src.x;
        const forceX = dx * springStrength;
        // Apply soft nudge along X
        src.x += forceX * 0.4;
        dst.x -= forceX * 0.4;
      }
    }

    // Repulsion between nodes in the same tier to prevent label overlaps
    const nodeArray = Array.from(layoutNodes.values());
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const a = nodeArray[i];
        const b = nodeArray[j];
        if (a.tier === b.tier && a.visible && b.visible) {
          const dx = b.x - a.x;
          const dist = Math.abs(dx);
          const minSpacing = 130;
          if (dist < minSpacing) {
            const push = (minSpacing - dist) / 2;
            const sign = dx >= 0 ? 1 : -1;
            b.x += sign * push * 0.5;
            a.x -= sign * push * 0.5;
          }
        }
      }
    }
  }

  // 5. Build edge layout items and compute bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  let visibleNodeCount = 0;
  for (const n of layoutNodes.values()) {
    if (n.visible) {
      visibleNodeCount++;
      minX = Math.min(minX, n.x - 80);
      maxX = Math.max(maxX, n.x + 80);
      minY = Math.min(minY, n.y - 40);
      maxY = Math.max(maxY, n.y + 40);
    }
  }

  if (minX === Infinity) {
    minX = 0;
    maxX = 1200;
    minY = 0;
    maxY = 800;
  }

  const layoutEdges: LayoutEdge[] = edges.map((e) => {
    const src = layoutNodes.get(e.src);
    const dst = layoutNodes.get(e.dst);
    const isVisible = Boolean(src?.visible && dst?.visible);
    return {
      id: e.id,
      src: e.src,
      dst: e.dst,
      type: e.type,
      claim: e.claim,
      status: e.status,
      isLayered: isLayeredEdge(e.type),
      visible: isVisible,
    };
  });

  const visibleEdgeCount = layoutEdges.filter((e) => e.visible).length;

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(1200, maxX - minX + 100),
      height: Math.max(700, maxY - minY + 100),
    },
    visibleCount: {
      nodes: visibleNodeCount,
      edges: visibleEdgeCount,
    },
  };
}
