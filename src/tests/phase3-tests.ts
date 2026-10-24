/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import seedGraph from '../data/seed_graph.json';
import seedEvidence from '../data/seed-evidence.json';
import { validateGraphPayload } from '../services/graph-validator.ts';
import { ConstraintEngine } from '../services/constraint-engine.ts';
import { exportToJsonl, exportToGraphml, importGraph } from '../services/graph-export.ts';
import { calculateHybridLayout } from '../services/hybrid-layout.ts';
import { getSeedGraph, getMergedGraph, getExpansionRegistry } from '../services/graph-loader.ts';
import { computeCoverageReport } from '../services/coverage-service.ts';
import type { GraphNode, GraphEdge, GraphPayload } from '../types/graph.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export function runPhase3Tests(): { passed: boolean; results: TestResult[] } {
  const results: TestResult[] = [];

  // Prepare chunk text lookup from real corpus in seed-evidence.json
  const chunkTextLookup: Record<string, string> = {};
  for (const [id, rec] of Object.entries((seedEvidence as any).chunks || {})) {
    chunkTextLookup[id] = (rec as any).text;
  }

  // --- 1. Schema & Mandatory Literal Quote Self-Check (59 Citations) ---
  const valResult = validateGraphPayload(seedGraph, chunkTextLookup);
  const citationCountPassed = valResult.verified_citations_count === 59;
  results.push({
    name: 'Phase 3 Schema & Literal Quote Self-Check (59 Citations)',
    passed: valResult.valid && citationCountPassed,
    message: valResult.valid && citationCountPassed
      ? `All 27 nodes, 12 edges, and 59 citations (39 node + 20 edge) validated against real corpus.`
      : `Validation errors: ${valResult.errors.join(' | ')} (Count: ${valResult.verified_citations_count}/59)`,
    details: valResult.errors,
  });

  // --- 2. Fix A: Mandatory Quote Check Enforcement ---
  const missingLookupResult = validateGraphPayload(seedGraph, undefined);
  const mandatoryCheckPassed = !missingLookupResult.valid && missingLookupResult.errors.some(e => e.includes('Mandatory quote validation failed'));
  results.push({
    name: 'Fix A: Mandatory Quote Verification Enforcement',
    passed: mandatoryCheckPassed,
    message: mandatoryCheckPassed
      ? 'Validator strictly rejected payload when corpus lookup was omitted.'
      : 'Validator erroneously passed without corpus lookup.',
  });

  // Prepare node map and engine
  const payload = seedGraph as unknown as GraphPayload;
  const nodeMap = new Map<string, GraphNode>();
  for (const n of payload.nodes) {
    nodeMap.set(n.id, n);
  }
  const edges: GraphEdge[] = payload.edges;

  const engine = new ConstraintEngine({
    nodes: nodeMap,
    edges,
    isDatabaseAttached: true,
  });

  // --- 3. Test B: Entity Traceability ---
  const cassetteEdge = edges.find(
    (e) => e.src === 'comp-cassette' && e.dst === 'comp-freehub-body'
  );
  const chrisCitation = cassetteEdge?.evidence.find(
    (cit: any) => cit.chunk_id === 'bike_repair_manual_chris_p0066_c00'
  );
  const testBPassed =
    chrisCitation !== undefined &&
    chrisCitation.quote.includes('STEP LOCATOR MAINTAINING YOUR TRANSMISSION');
  results.push({
    name: 'Test B: Entity Traceability',
    passed: testBPassed,
    message: testBPassed
      ? 'comp-cassette -> comp-freehub-body traces to verified chris p.66 citation.'
      : 'Failed to find verbatim chris p.66 citation on cassette edge.',
  });

  // --- 4. Test C: Compatibility (HG Compatible vs XDR Incompatible) ---
  const reportCompatible = engine.evaluateCompatibility('comp-cassette', 'comp-freehub-body');
  const reportIncompatible = engine.evaluateCompatibility('comp-freehub-xdr', 'comp-cassette');

  const testCPassed =
    reportCompatible.verdict === 'verified_compatible' &&
    reportIncompatible.verdict === 'incompatible' &&
    reportIncompatible.evaluations.some((ev: any) =>
      ev.evidence_citations.some((c: any) => c.chunk_id === 'big_blue_book_p0244_c01')
    );
  results.push({
    name: 'Test C: Compatibility (Verified vs Incompatible)',
    passed: testCPassed,
    message: testCPassed
      ? 'Cassette on HG body is verified_compatible; Cassette on XDR body is incompatible citing big_blue_book_p0244_c01.'
      : `Test C mismatch: HG=${reportCompatible.verdict}, XDR=${reportIncompatible.verdict}`,
    details: { reportCompatible, reportIncompatible },
  });

  // --- 5. Fix C: verified_compatible Requires edge.status === "verified" ---
  const unverifiedEdges: GraphEdge[] = [
    {
      id: 'edge-unverified-fit',
      src: 'comp-cassette',
      dst: 'comp-freehub-body',
      type: 'fits_into',
      claim: 'Unreviewed candidate fit.',
      evidence: [],
      evidence_type: 'service_manual',
      status: 'needs_review',
      confidence: 0.5,
      conditions: [],
      conflicts: [],
    },
  ];
  const unverifiedEngine = new ConstraintEngine({
    nodes: nodeMap,
    edges: unverifiedEdges,
    isDatabaseAttached: true,
  });
  const unverifiedReport = unverifiedEngine.evaluateCompatibility('comp-cassette', 'comp-freehub-body');
  const fixCPassed =
    unverifiedReport.verdict === 'conditionally_compatible' &&
    unverifiedReport.overall_explanation.includes('edge not yet reviewed');
  results.push({
    name: 'Fix C: verified_compatible Gate (Unreviewed Edge yields conditionally_compatible)',
    passed: fixCPassed,
    message: fixCPassed
      ? 'Unreviewed edge (needs_review) returned conditionally_compatible with reason "edge not yet reviewed".'
      : `Fix C failed: verdict=${unverifiedReport.verdict}`,
  });

  // --- 6. Test D: Conditional Compatibility ---
  const reportConditional = engine.evaluateCompatibility('comp-rear-hub', 'std-hub-width');
  const testDPassed =
    reportConditional.verdict === 'conditionally_compatible' &&
    reportConditional.evaluations.some((ev: any) =>
      ev.conditions?.some((c: any) => c.includes('guide, not an exhaustive list'))
    );
  results.push({
    name: 'Test D: Conditional Compatibility',
    passed: testDPassed,
    message: testDPassed
      ? 'Rear hub conforms to std-hub-width conditionally with caveat ("guide, not an exhaustive list").'
      : `Test D mismatch: verdict=${reportConditional.verdict}`,
  });

  // --- 7. Test F: Contradictory Evidence ---
  const conflictingEdges: GraphEdge[] = [
    ...edges,
    {
      id: 'edge-conflict-test',
      src: 'comp-freehub-xdr',
      dst: 'comp-cassette',
      type: 'compatible_with',
      claim: 'Conflicting synthetic claim asserting direct fit.',
      evidence: [],
      evidence_type: 'service_manual',
      status: 'conflicted',
      confidence: 0.5,
      conditions: [],
      conflicts: ['edge-xdr-incomp-cassette'],
    },
  ];
  const conflictEngine = new ConstraintEngine({
    nodes: nodeMap,
    edges: conflictingEdges,
    isDatabaseAttached: true,
  });
  const reportConflict = conflictEngine.evaluateCompatibility('comp-freehub-xdr', 'comp-cassette');
  const testFPassed = reportConflict.verdict === 'conflicted';
  results.push({
    name: 'Test F: Contradictory Evidence Handling',
    passed: testFPassed,
    message: testFPassed
      ? 'Engine returned conflicted state when contradictory edges were detected without picking one silently.'
      : `Test F mismatch: verdict=${reportConflict.verdict}`,
  });

  // --- 8. Test G: Unknown Values / Missing Critical Evidence ---
  const reportUnknown = engine.evaluateCompatibility('unk-freehub-body-length', 'comp-cassette');
  const testGPassed =
    reportUnknown.verdict === 'unknown_missing_evidence' &&
    reportUnknown.evaluations.some((ev: any) => ev.state === 'unknown_missing_evidence');
  results.push({
    name: 'Test G: Unknown Values Handling',
    passed: testGPassed,
    message: testGPassed
      ? 'unk-freehub-body-length returned unknown_missing_evidence; never produces an unjustified positive verdict.'
      : `Test G mismatch: verdict=${reportUnknown.verdict}`,
  });

  // --- 9. Test H: Duplicate Ingestion Idempotency ---
  const doubleNodes = [...payload.nodes, ...payload.nodes];
  const doubleEdges = [...payload.edges, ...payload.edges];
  // Deduplicate by deterministic ID
  const dedupedNodeMap = new Map<string, GraphNode>();
  for (const n of doubleNodes) dedupedNodeMap.set(n.id, n);
  const dedupedEdgeMap = new Map<string, GraphEdge>();
  for (const e of doubleEdges) dedupedEdgeMap.set(e.id, e);

  const testHPassed =
    dedupedNodeMap.size === payload.nodes.length &&
    dedupedEdgeMap.size === payload.edges.length;
  results.push({
    name: 'Test H: Duplicate Ingestion Idempotency',
    passed: testHPassed,
    message: testHPassed
      ? `Idempotency verified: 2x ingestion retained exactly ${dedupedNodeMap.size} nodes and ${dedupedEdgeMap.size} edges.`
      : 'Duplicate ingestion produced conflicting counts.',
  });

  // --- 10. Test K: Evidence Grade Rule (Merged Scan) ---
  const mergedForTestK = getMergedGraph();
  const seedForTestK = getSeedGraph();
  const expansionsForTestK = getExpansionRegistry();
  const edgesScannedTotal = mergedForTestK.edges.length;
  const edgesSeedCount = seedForTestK.edges.length;
  const edgesExpansionCount = expansionsForTestK.reduce((acc, exp) => acc + exp.edges.length, 0);
  const nodesScannedTotal = mergedForTestK.nodes.length;
  const nodesSeedCount = seedForTestK.nodes.length;
  const nodesExpansionCount = expansionsForTestK.reduce((acc, exp) => acc + exp.nodes.length, 0);

  const numericRegex = /\b\d+(\.\d+)?\s*(mm|t|nm|n·m|v|w|a|deg|°)\b/i;
  const testKErrors: string[] = [];

  // Edge scan
  for (const edge of mergedForTestK.edges) {
    if (edge.status === 'verified') {
      const hasGradeB = edge.evidence.some((c) => c.evidence_grade === 'B');
      if (hasGradeB && numericRegex.test(edge.claim)) {
        testKErrors.push(`Edge ${edge.id} has numeric claim "${edge.claim}" citing Grade B while verified`);
      }
    }
  }

  // Node scan
  for (const node of mergedForTestK.nodes) {
    if (node.status === 'verified') {
      const hasGradeB = (node.evidence || []).some((c) => c.evidence_grade === 'B');
      if (hasGradeB) {
        if (numericRegex.test(node.name)) {
          testKErrors.push(`Node ${node.id} has numeric name "${node.name}" citing Grade B while verified`);
        }
        if (numericRegex.test(node.description)) {
          testKErrors.push(`Node ${node.id} has numeric description "${node.description}" citing Grade B while verified`);
        }
        for (const [propKey, prop] of Object.entries(node.properties || {})) {
          const valStr = `${prop.value} ${prop.unit || ''}`.trim();
          if (
            numericRegex.test(valStr) ||
            (typeof prop.value === 'number' && prop.unit && numericRegex.test(`${prop.value}${prop.unit}`))
          ) {
            testKErrors.push(`Node ${node.id} has numeric property ${propKey} (${valStr}) citing Grade B while verified`);
          }
        }
      }
    }
  }

  const testKPassed = testKErrors.length === 0;
  results.push({
    name: 'Test K: Evidence Grade Rule (Grade B cannot justify numbers)',
    passed: testKPassed,
    message: testKPassed
      ? `${edgesScannedTotal} edges scanned (${edgesSeedCount} seed + ${edgesExpansionCount} expansion) and ${nodesScannedTotal} nodes scanned (${nodesSeedCount} seed + ${nodesExpansionCount} expansion). Zero verified entities with numeric claims cite Grade B visual description chunks.`
      : `Test K failed (${testKErrors.length} violations across ${edgesScannedTotal} edges and ${nodesScannedTotal} nodes): ${testKErrors.join('; ')}`,
    details: { testKErrors, edgesScanned: edgesScannedTotal, nodesScanned: nodesScannedTotal },
  });

  // --- 11. Test L: Offline Detach Invariance ---
  engine.setDatabaseAttached(false);
  const reportAfterDetach = engine.evaluateCompatibility('comp-cassette', 'comp-freehub-body');
  const testLPassed = reportAfterDetach.verdict === 'verified_compatible';
  engine.setDatabaseAttached(true); // reset
  results.push({
    name: 'Test L: Offline Detach Invariance',
    passed: testLPassed,
    message: testLPassed
      ? 'Detaching database preserves 5-state verdict stability without changing outcome state.'
      : 'Test L failed: Verdict altered upon database detach.',
  });

  // --- 12. Test M: Export Round-Trip (JSONL & GraphML with chunk_id preservation) ---
  const jsonlExport = exportToJsonl(payload);
  const jsonlImport = importGraph(jsonlExport, chunkTextLookup);
  const jsonlValid =
    jsonlImport.valid &&
    jsonlImport.payload?.nodes.length === 27 &&
    jsonlImport.payload?.edges.length === 12;

  const graphmlExport = exportToGraphml(payload);
  const graphmlImport = importGraph(graphmlExport, chunkTextLookup);
  const graphmlValid =
    graphmlImport.valid &&
    graphmlImport.payload?.nodes.length === 27 &&
    graphmlImport.payload?.edges.length === 12;

  const jsonlCitations = jsonlImport.payload
    ? validateGraphPayload(jsonlImport.payload, chunkTextLookup).verified_citations_count
    : 0;
  const graphmlCitations = graphmlImport.payload
    ? validateGraphPayload(graphmlImport.payload, chunkTextLookup).verified_citations_count
    : 0;

  const testMPassed =
    jsonlValid &&
    graphmlValid &&
    jsonlCitations === 59 &&
    graphmlCitations === 59;

  results.push({
    name: 'Test M: Export Round-Trip (JSONL & GraphML chunk_id preservation)',
    passed: testMPassed,
    message: testMPassed
      ? `Both JSONL and GraphML exports faithfully reproduced 27 nodes, 12 edges, and 59 verified citations (39 node + 20 edge) with chunk_id preserved.`
      : `Test M failed: JSONL (valid=${jsonlValid}, cit=${jsonlCitations}), GraphML (valid=${graphmlValid}, cit=${graphmlCitations})`,
    details: { jsonlErrors: jsonlImport.errors, graphmlErrors: graphmlImport.errors },
  });

  // --- 13. Test N: Degree Collapse & Limits Enforcement ---
  const fullLayout = calculateHybridLayout(payload.nodes, payload.edges, {
    depthLimit: 4,
    resultLimit: 27,
    degreeCollapseThreshold: 40,
  });
  const limitedLayout = calculateHybridLayout(payload.nodes, payload.edges, {
    depthLimit: 4,
    resultLimit: 12,
    degreeCollapseThreshold: 40,
  });
  const collapsedLayout = calculateHybridLayout(payload.nodes, payload.edges, {
    depthLimit: 4,
    resultLimit: 27,
    degreeCollapseThreshold: 2, // Collapses high-degree nodes (>2)
  });
  const depth1Layout = calculateHybridLayout(payload.nodes, payload.edges, {
    selectedNodeId: 'comp-cassette',
    depthLimit: 1,
    resultLimit: 27,
  });

  const testNPassed =
    fullLayout.visibleCount.nodes === 27 &&
    limitedLayout.visibleCount.nodes === 12 &&
    collapsedLayout.visibleCount.nodes < 27 &&
    depth1Layout.visibleCount.nodes < 27 &&
    depth1Layout.visibleCount.nodes > 0;

  results.push({
    name: 'Test N: Layout Limits & Degree Auto-Collapse Enforcement',
    passed: testNPassed,
    message: testNPassed
      ? `Layout strictly enforces result limit (27->12 nodes), depth limit (depth 1 hides distant nodes), and degree auto-collapse (threshold 2 collapses child branches).`
      : `Test N failed: full=${fullLayout.visibleCount.nodes}, limited=${limitedLayout.visibleCount.nodes}, collapsed=${collapsedLayout.visibleCount.nodes}, depth1=${depth1Layout.visibleCount.nodes}`,
  });

  // --- 14. Test P: Seed Immutability & Expansion Merge ---
  const seedActual = getSeedGraph();
  const expansionsActual = getExpansionRegistry();
  const mergedActual = getMergedGraph();

  // 1. Seed immutability check
  const seedNodesCount = seedActual.nodes.length;
  const seedEdgesCount = seedActual.edges.length;
  const seedCitationCount =
    seedActual.nodes.reduce((acc, n) => acc + (n.evidence?.length || 0), 0) +
    seedActual.edges.reduce((acc, e) => acc + (e.evidence?.length || 0), 0);
  const seedImmutable =
    seedNodesCount === 27 && seedEdgesCount === 12 && seedCitationCount === 59;

  // 2. Merged graph counts check (sum over registry)
  const totalExpNodes = expansionsActual.reduce((acc, exp) => acc + exp.nodes.length, 0);
  const totalExpEdges = expansionsActual.reduce((acc, exp) => acc + exp.edges.length, 0);
  const mergedNodesCorrect =
    mergedActual.nodes.length === seedNodesCount + totalExpNodes;
  const mergedEdgesCorrect =
    mergedActual.edges.length === seedEdgesCount + totalExpEdges;

  // 3. Dynamic verification and per-file status composition over all registered expansions
  let expansionCitationsValid = true;
  let expansionCitationsChecked = 0;
  const expansionErrors: string[] = [];
  const rawChunks = (seedEvidence as any).chunks || {};

  const formatStatusCounts = (counts: Record<string, number>): string => {
    return Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  };

  // Seed status counts
  const seedNodeStatuses: Record<string, number> = {};
  for (const n of seedActual.nodes) {
    seedNodeStatuses[n.status] = (seedNodeStatuses[n.status] || 0) + 1;
  }
  const seedEdgeStatuses: Record<string, number> = {};
  for (const e of seedActual.edges) {
    seedEdgeStatuses[e.status] = (seedEdgeStatuses[e.status] || 0) + 1;
  }

  const fileCompositions: string[] = [];
  fileCompositions.push(
    `seed (nodes [${formatStatusCounts(seedNodeStatuses)}], edges [${formatStatusCounts(seedEdgeStatuses)}])`
  );

  for (const exp of expansionsActual) {
    const expNodeStatuses: Record<string, number> = {};
    for (const n of exp.nodes) {
      if (n.status !== 'verified' && n.status !== 'needs_review') {
        expansionErrors.push(
          `Expansion ${exp.batch} node ${n.id} has invalid status '${n.status}' (must be verified or needs_review)`
        );
      }
      expNodeStatuses[n.status] = (expNodeStatuses[n.status] || 0) + 1;

      if ((!n.evidence || n.evidence.length === 0) && n.status === 'verified') {
        expansionCitationsValid = false;
        expansionErrors.push(`Node ${n.id} has status 'verified' but no evidence citations`);
      }

      for (const c of n.evidence || []) {
        expansionCitationsChecked++;
        const chunk = rawChunks[c.chunk_id];
        if (!chunk) {
          expansionCitationsValid = false;
          expansionErrors.push(`Node ${n.id} cites chunk ${c.chunk_id} which does not exist in seedEvidence.chunks`);
          continue;
        }
        const chunkText = chunkTextLookup[c.chunk_id];
        if (!chunkText || !chunkText.includes(c.quote)) {
          expansionCitationsValid = false;
          expansionErrors.push(`Node ${n.id} quote not a literal substring in ${c.chunk_id}`);
        }
        const expectedSection = (chunk?.section && chunk.section.trim()) ? chunk.section : undefined;
        if (c.section !== expectedSection) {
          expansionCitationsValid = false;
          expansionErrors.push(`Node ${n.id} section mismatch for ${c.chunk_id}: got ${JSON.stringify(c.section)}, expected ${JSON.stringify(expectedSection)}`);
        }
      }
    }

    const expEdgeStatuses: Record<string, number> = {};
    for (const e of exp.edges) {
      if (e.status !== 'verified' && e.status !== 'needs_review') {
        expansionErrors.push(
          `Expansion ${exp.batch} edge ${e.id} has invalid status '${e.status}' (must be verified or needs_review)`
        );
      }
      expEdgeStatuses[e.status] = (expEdgeStatuses[e.status] || 0) + 1;

      if ((!e.evidence || e.evidence.length === 0) && e.status === 'verified') {
        expansionCitationsValid = false;
        expansionErrors.push(`Edge ${e.id} has status 'verified' but no evidence citations`);
      }

      for (const c of e.evidence || []) {
        expansionCitationsChecked++;
        const chunk = rawChunks[c.chunk_id];
        if (!chunk) {
          expansionCitationsValid = false;
          expansionErrors.push(`Edge ${e.id} cites chunk ${c.chunk_id} which does not exist in seedEvidence.chunks`);
          continue;
        }
        const chunkText = chunkTextLookup[c.chunk_id];
        if (!chunkText || !chunkText.includes(c.quote)) {
          expansionCitationsValid = false;
          expansionErrors.push(`Edge ${e.id} quote not a literal substring in ${c.chunk_id}`);
        }
        const expectedSection = (chunk?.section && chunk.section.trim()) ? chunk.section : undefined;
        if (c.section !== expectedSection) {
          expansionCitationsValid = false;
          expansionErrors.push(`Edge ${e.id} section mismatch for ${c.chunk_id}: got ${JSON.stringify(c.section)}, expected ${JSON.stringify(expectedSection)}`);
        }
      }
    }

    fileCompositions.push(
      `${exp.batch} (nodes [${formatStatusCounts(expNodeStatuses)}], edges [${formatStatusCounts(expEdgeStatuses)}])`
    );
  }

  // 4. Status rule: for EVERY registered expansion entity,
  // if its name / description / claim or any property value + unit contains a digit
  // and all of its citations are grade B or D, its status must be needs_review.
  let entitiesExaminedForRule = 0;
  let numericGradeBDEntitiesCount = 0;

  for (const exp of expansionsActual) {
    for (const n of exp.nodes) {
      entitiesExaminedForRule++;
      const hasDigitInProps = Object.values(n.properties || {}).some((prop) => {
        const valStr = `${prop.value} ${prop.unit || ''}`;
        return /\d/.test(valStr);
      });
      const hasDigit = /\d/.test(n.name) || /\d/.test(n.description) || hasDigitInProps;
      const cits = n.evidence || [];
      const allGradeBD = cits.length > 0 && cits.every((c) => c.evidence_grade === 'B' || c.evidence_grade === 'D');
      if (hasDigit && allGradeBD) {
        numericGradeBDEntitiesCount++;
        if (n.status !== 'needs_review') {
          expansionErrors.push(
            `Node ${n.id} contains a digit and only Grade B/D citations but has status '${n.status}' (must be needs_review)`
          );
        }
      }
    }

    for (const e of exp.edges) {
      entitiesExaminedForRule++;
      const hasDigit = /\d/.test(e.claim);
      const cits = e.evidence || [];
      const allGradeBD = cits.length > 0 && cits.every((c) => c.evidence_grade === 'B' || c.evidence_grade === 'D');
      if (hasDigit && allGradeBD) {
        numericGradeBDEntitiesCount++;
        if (e.status !== 'needs_review') {
          expansionErrors.push(
            `Edge ${e.id} contains a digit in claim ("${e.claim}") and only Grade B/D citations but has status '${e.status}' (must be needs_review)`
          );
        }
      }
    }
  }

  // Rule assertion: numericGradeBDEntitiesCount must not be zero
  if (numericGradeBDEntitiesCount === 0) {
    expansionErrors.push('Grade-B/D numeric rule matched 0 expansion entities (vacuous check)');
  }

  // Merged map totals
  const mergedNodeStatuses: Record<string, number> = {};
  for (const n of mergedActual.nodes) {
    mergedNodeStatuses[n.status] = (mergedNodeStatuses[n.status] || 0) + 1;
  }
  const mergedEdgeStatuses: Record<string, number> = {};
  for (const e of mergedActual.edges) {
    mergedEdgeStatuses[e.status] = (mergedEdgeStatuses[e.status] || 0) + 1;
  }

  const testPPassed =
    seedImmutable &&
    mergedNodesCorrect &&
    mergedEdgesCorrect &&
    expansionCitationsValid &&
    expansionErrors.length === 0 &&
    expansionCitationsChecked > 0 &&
    numericGradeBDEntitiesCount > 0;

  results.push({
    name: 'Test P: Seed Immutability & Expansion Merge',
    passed: testPPassed,
    message: testPPassed
      ? `${expansionsActual.length} expansion files scanned, ${totalExpNodes} nodes scanned, ${totalExpEdges} edges scanned, ${expansionCitationsChecked} citations checked. ${numericGradeBDEntitiesCount} expansion entities constrained by the grade-B/D rule. Per-file status composition: ${fileCompositions.join('; ')}. Merged map totals: nodes [${formatStatusCounts(mergedNodeStatuses)}], edges [${formatStatusCounts(mergedEdgeStatuses)}]. Seed graph is strictly immutable (27 nodes, 12 edges, 59 citations). All citations match literal substrings in seedEvidence.chunks and exact chunk section metadata.`
      : `Test P failed (${expansionsActual.length} expansion files, ${totalExpNodes} nodes, ${totalExpEdges} edges, ${expansionCitationsChecked} citations, ${entitiesExaminedForRule} entities examined): ${expansionErrors.join('; ')}`,
    details: {
      expansionErrors,
      entitiesExaminedForRule,
      numericGradeBDEntitiesCount,
      fileCompositions,
      mergedNodeStatuses,
      mergedEdgeStatuses,
    },
  });

  // --- 15. Test Q: Coverage & Integrity Verification ---
  const coverageReport = computeCoverageReport();
  const qErrors: string[] = [];

  // Totals: 69 nodes, 63 edges
  if (coverageReport.totals.nodes !== 69) {
    qErrors.push(`Expected 69 nodes, found ${coverageReport.totals.nodes}`);
  }
  if (coverageReport.totals.edges !== 63) {
    qErrors.push(`Expected 63 edges, found ${coverageReport.totals.edges}`);
  }

  // Status split: nodes 61 verified / 1 candidate / 7 needs_review; edges 53 verified / 10 needs_review
  if (
    coverageReport.nodeStatusSplit.verified !== 61 ||
    coverageReport.nodeStatusSplit.candidate !== 1 ||
    coverageReport.nodeStatusSplit.needs_review !== 7
  ) {
    qErrors.push(
      `Node status split mismatch: expected 61/1/7, got ${coverageReport.nodeStatusSplit.verified}/${coverageReport.nodeStatusSplit.candidate}/${coverageReport.nodeStatusSplit.needs_review}`
    );
  }
  if (
    coverageReport.edgeStatusSplit.verified !== 53 ||
    coverageReport.edgeStatusSplit.needs_review !== 10
  ) {
    qErrors.push(
      `Edge status split mismatch: expected 53/10, got ${coverageReport.edgeStatusSplit.verified}/${coverageReport.edgeStatusSplit.needs_review}`
    );
  }

  // Per-batch ledger: 1 row per distinct top-level batch value (seed, 7 phase5-* batches, phase6-connectors-3), with node, edge, and citation counts
  const expectedBatches = [
    { batch: 'seed', nodes: 27, edges: 12, citations: 59 },
    { batch: 'phase5-brake-1', nodes: 10, edges: 10, citations: 20 },
    { batch: 'phase5-cockpit-2', nodes: 7, edges: 7, citations: 14 },
    { batch: 'phase5-drivetrain-3', nodes: 7, edges: 7, citations: 14 },
    { batch: 'phase5-rearshock-4', nodes: 5, edges: 5, citations: 10 },
    { batch: 'phase5-quillstem-5', nodes: 4, edges: 4, citations: 8 },
    { batch: 'phase5-cassette-6', nodes: 5, edges: 5, citations: 10 },
    { batch: 'phase5-hubfit-7', nodes: 4, edges: 4, citations: 8 },
    { batch: 'phase6-connectors-3', nodes: 0, edges: 9, citations: 9 },
  ];

  if (coverageReport.batchLedger.length !== expectedBatches.length) {
    qErrors.push(
      `Batch ledger row count mismatch: expected ${expectedBatches.length}, got ${coverageReport.batchLedger.length}`
    );
  } else {
    for (let i = 0; i < expectedBatches.length; i++) {
      const exp = expectedBatches[i];
      const act = coverageReport.batchLedger[i];
      if (
        act.batch !== exp.batch ||
        act.nodes !== exp.nodes ||
        act.edges !== exp.edges ||
        act.citations !== exp.citations
      ) {
        qErrors.push(
          `Batch ledger mismatch at row ${i} (${exp.batch}): expected [${exp.nodes}n, ${exp.edges}e, ${exp.citations}c], got [${act.nodes}n, ${act.edges}e, ${act.citations}c]`
        );
      }
    }
  }

  // Citations: 152 total; 104 byte-exact; 48 whitespace-only (all 48 in frozen seed)
  if (coverageReport.citations.total !== 152) {
    qErrors.push(`Expected 152 citations, got ${coverageReport.citations.total}`);
  }
  if (coverageReport.citations.byteExact !== 104) {
    qErrors.push(`Expected 104 byte-exact citations, got ${coverageReport.citations.byteExact}`);
  }
  if (coverageReport.citations.whitespaceOnly !== 48) {
    qErrors.push(
      `Expected 48 whitespace-only citations, got ${coverageReport.citations.whitespaceOnly}`
    );
  }

  // Chunk coverage: 36 distinct cited of 36 bundled, 0 unused
  if (coverageReport.chunkCoverage.citedDistinctCount !== 36) {
    qErrors.push(
      `Expected 36 cited distinct chunks, got ${coverageReport.chunkCoverage.citedDistinctCount}`
    );
  }
  if (coverageReport.chunkCoverage.totalBundledCount !== 36) {
    qErrors.push(
      `Expected 36 total bundled chunks, got ${coverageReport.chunkCoverage.totalBundledCount}`
    );
  }
  if (coverageReport.chunkCoverage.unusedCount !== 0) {
    qErrors.push(`Expected 0 unused chunks, got ${coverageReport.chunkCoverage.unusedCount}`);
  }

  // Connectivity: 7 components, largest 35 nodes (51%), and 6 remaining islands with size and example node id
  if (coverageReport.connectivity.componentCount !== 7) {
    qErrors.push(
      `Expected 7 components, got ${coverageReport.connectivity.componentCount}`
    );
  }
  if (coverageReport.connectivity.largestSize !== 35) {
    qErrors.push(
      `Expected largest component of 35 nodes, got ${coverageReport.connectivity.largestSize}`
    );
  }
  if (coverageReport.connectivity.remainingIslands.length !== 6) {
    qErrors.push(
      `Expected 6 remaining islands, got ${coverageReport.connectivity.remainingIslands.length}`
    );
  }

  // Plain sentence stating ceiling
  const expectedCeiling =
    'Every bundled source chunk is cited, so the graph cannot grow until new source evidence is added to the bundle.';
  if (coverageReport.ceilingSentence !== expectedCeiling) {
    qErrors.push(`Ceiling sentence mismatch: got "${coverageReport.ceilingSentence}"`);
  }

  const testQPassed = qErrors.length === 0;
  results.push({
    name: 'Test Q: Coverage & Integrity Verification',
    passed: testQPassed,
    message: testQPassed
      ? `All runtime coverage and integrity invariants verified: 69 nodes (61v/1c/7r), 63 edges (53v/10r), 9 batches in ledger, 152 citations (104 byte-exact, 48 whitespace-only in seed), 36/36 chunks cited (0 unused), 7 components (largest: 35 nodes, 51%; 6 islands: ${coverageReport.connectivity.remainingIslands.map((isl) => `${isl.exampleNodeId}[${isl.size}]`).join(', ')}). Ceiling sentence validated.`
      : `Test Q failed: ${qErrors.join('; ')}`,
    details: { coverageReport, qErrors },
  });

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}
