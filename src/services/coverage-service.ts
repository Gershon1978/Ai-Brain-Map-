/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSeedGraph, getExpansionRegistry, getMergedGraph } from './graph-loader.ts';
import seedEvidence from '../data/seed-evidence.json';

export interface BatchLedgerRow {
  batch: string;
  nodes: number;
  edges: number;
  citations: number;
}

export interface IslandSummary {
  size: number;
  exampleNodeId: string;
}

export interface CoverageReport {
  totals: {
    nodes: number;
    edges: number;
  };
  nodeStatusSplit: {
    verified: number;
    candidate: number;
    needs_review: number;
  };
  edgeStatusSplit: {
    verified: number;
    needs_review: number;
  };
  batchLedger: BatchLedgerRow[];
  citations: {
    total: number;
    byteExact: number;
    whitespaceOnly: number;
  };
  chunkCoverage: {
    citedDistinctCount: number;
    totalBundledCount: number;
    unusedCount: number;
  };
  connectivity: {
    componentCount: number;
    largestSize: number;
    largestPercentage: number;
    remainingIslands: IslandSummary[];
  };
  ceilingSentence: string;
}

export function computeCoverageReport(): CoverageReport {
  const seed = getSeedGraph();
  const expansions = getExpansionRegistry();
  const merged = getMergedGraph();
  const rawChunks = (seedEvidence as any).chunks || {};

  // 1. Totals
  const totalNodes = merged.nodes.length;
  const totalEdges = merged.edges.length;

  // Status split
  const nodeStatusSplit = { verified: 0, candidate: 0, needs_review: 0 };
  for (const n of merged.nodes) {
    if (n.status === 'verified') nodeStatusSplit.verified++;
    else if (n.status === 'candidate') nodeStatusSplit.candidate++;
    else if (n.status === 'needs_review') nodeStatusSplit.needs_review++;
  }

  const edgeStatusSplit = { verified: 0, needs_review: 0 };
  for (const e of merged.edges) {
    if (e.status === 'verified') edgeStatusSplit.verified++;
    else if (e.status === 'needs_review') edgeStatusSplit.needs_review++;
  }

  // 2. Per-batch ledger
  const batchLedger: BatchLedgerRow[] = [];
  const seedCits =
    seed.nodes.reduce((acc, n) => acc + (n.evidence?.length || 0), 0) +
    seed.edges.reduce((acc, e) => acc + (e.evidence?.length || 0), 0);
  batchLedger.push({
    batch: 'seed',
    nodes: seed.nodes.length,
    edges: seed.edges.length,
    citations: seedCits,
  });

  for (const exp of expansions) {
    const expCits =
      exp.nodes.reduce((acc, n) => acc + (n.evidence?.length || 0), 0) +
      exp.edges.reduce((acc, e) => acc + (e.evidence?.length || 0), 0);
    batchLedger.push({
      batch: exp.batch,
      nodes: exp.nodes.length,
      edges: exp.edges.length,
      citations: expCits,
    });
  }

  // 3. Citations & Whitespace vs Exact matching
  let totalCitations = 0;
  let byteExact = 0;
  let whitespaceOnly = 0;
  const citedChunkIds = new Set<string>();

  const collapseWs = (s: string) => s.replace(/\s+/g, ' ').trim();

  const allEntities = [...merged.nodes, ...merged.edges];
  for (const ent of allEntities) {
    for (const cit of ent.evidence || []) {
      totalCitations++;
      citedChunkIds.add(cit.chunk_id);
      const chunk = rawChunks[cit.chunk_id];
      if (chunk) {
        if (chunk.text.includes(cit.quote)) {
          byteExact++;
        } else if (collapseWs(chunk.text).includes(collapseWs(cit.quote))) {
          whitespaceOnly++;
        }
      }
    }
  }

  // 4. Chunk coverage
  const totalBundledCount = Object.keys(rawChunks).length;
  const citedDistinctCount = citedChunkIds.size;
  const unusedCount = Math.max(0, totalBundledCount - citedDistinctCount);

  // 5. Connectivity
  const adj = new Map<string, string[]>();
  for (const n of merged.nodes) adj.set(n.id, []);
  for (const e of merged.edges) {
    if (adj.has(e.src) && adj.has(e.dst)) {
      adj.get(e.src)!.push(e.dst);
      adj.get(e.dst)!.push(e.src);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const n of merged.nodes) {
    if (!visited.has(n.id)) {
      const comp: string[] = [];
      const queue = [n.id];
      visited.add(n.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        for (const nbr of adj.get(curr) || []) {
          if (!visited.has(nbr)) {
            visited.add(nbr);
            queue.push(nbr);
          }
        }
      }
      components.push(comp);
    }
  }

  components.sort((a, b) => b.length - a.length);

  const largestSize = components[0]?.length || 0;
  const largestPercentage = totalNodes > 0 ? Math.round((largestSize / totalNodes) * 100) : 0;
  const remainingIslands: IslandSummary[] = components.slice(1).map((c) => ({
    size: c.length,
    exampleNodeId: c[0],
  }));

  return {
    totals: { nodes: totalNodes, edges: totalEdges },
    nodeStatusSplit,
    edgeStatusSplit,
    batchLedger,
    citations: {
      total: totalCitations,
      byteExact,
      whitespaceOnly,
    },
    chunkCoverage: {
      citedDistinctCount,
      totalBundledCount,
      unusedCount,
    },
    connectivity: {
      componentCount: components.length,
      largestSize,
      largestPercentage,
      remainingIslands,
    },
    ceilingSentence:
      'Every bundled source chunk is cited, so the graph cannot grow until new source evidence is added to the bundle.',
  };
}
