/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  GraphNode,
  GraphEdge,
  EvidenceCitation,
  CompatibilityReport,
  ConstraintEvaluation,
} from '../types/graph.ts';
import {
  evaluateCompatibility,
  VerdictState,
} from '../services/constraint-engine.ts';
import { getGradeRationale } from '../services/provenance-service.ts';
import {
  isDatabaseAttached,
  getAttachedChunk,
} from '../services/sqlite-service.ts';
import seedEvidence from '../data/seed-evidence.json';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  Info,
} from 'lucide-react';

interface DetailPaneProps {
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onClose: () => void;
}

export function DetailPane({
  selectedNode,
  selectedEdge,
  allNodes,
  allEdges,
  onSelectNode,
  onSelectEdge,
  onClose,
}: DetailPaneProps) {
  // Compatibility evaluation target state
  const [targetComponentId, setTargetComponentId] = useState<string>('');

  // Look up full chunk text from attached SQLite DB or bundled seedEvidence
  const getFullChunkText = (chunkId: string): string | null => {
    if (isDatabaseAttached()) {
      const dbChunk = getAttachedChunk(chunkId);
      if (dbChunk) return dbChunk.text;
    }
    const seed = (seedEvidence as unknown as { chunks?: Record<string, { text: string }> }).chunks?.[chunkId];
    return seed?.text || null;
  };

  // Helper for verdict badge styling
  const renderVerdictBadge = (verdict: VerdictState) => {
    switch (verdict) {
      case 'verified_compatible':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>VERIFIED COMPATIBLE</span>
          </span>
        );
      case 'conditionally_compatible':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-700/60 font-mono text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>CONDITIONALLY COMPATIBLE</span>
          </span>
        );
      case 'incompatible':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-700/60 font-mono text-xs font-bold">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>INCOMPATIBLE</span>
          </span>
        );
      case 'conflicted':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-700/60 font-mono text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
            <span>CONFLICTED EVIDENCE</span>
          </span>
        );
      case 'unknown_missing_evidence':
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>UNKNOWN / MISSING EVIDENCE</span>
          </span>
        );
    }
  };

  // Render when EDGE is selected (Evidence Viewer View)
  if (selectedEdge) {
    const srcNode = allNodes.find((n) => n.id === selectedEdge.src);
    const dstNode = allNodes.find((n) => n.id === selectedEdge.dst);

    return (
      <aside className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full overflow-hidden select-none">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
              Edge Evidence Viewer
            </div>
            <div className="text-xs font-mono text-slate-300 flex items-center space-x-1">
              <button
                onClick={() => onSelectNode(selectedEdge.src)}
                className="text-sky-300 hover:underline truncate max-w-[120px] text-left"
                title={srcNode?.name || selectedEdge.src}
              >
                {srcNode?.name || selectedEdge.src}
              </button>
              <span className="text-slate-500 font-bold">── {selectedEdge.type} ──▶</span>
              <button
                onClick={() => onSelectNode(selectedEdge.dst)}
                className="text-emerald-300 hover:underline truncate max-w-[120px] text-left"
                title={dstNode?.name || selectedEdge.dst}
              >
                {dstNode?.name || selectedEdge.dst}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Edge Claim & Status */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400">
                Authoritative Claim
              </span>
              <div className="flex items-center space-x-1.5">
                {selectedEdge.batch && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                    {selectedEdge.batch}
                  </span>
                )}
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                    selectedEdge.status === 'verified'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}
                >
                  {selectedEdge.status}
                </span>
              </div>
            </div>
            <p className="text-slate-200 italic font-mono text-[11px] leading-relaxed">
              "{selectedEdge.claim}"
            </p>

            {selectedEdge.conditions && selectedEdge.conditions.length > 0 && (
              <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10.5px]">
                <strong>Condition:</strong> {selectedEdge.conditions.join('; ')}
              </div>
            )}
          </div>

          {/* Evidence Citations List (Guardrail 5) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Evidence Citations ({selectedEdge.evidence.length})</span>
              </span>
            </div>

            {selectedEdge.evidence.map((cit, idx) => {
              const fullText = getFullChunkText(cit.chunk_id);
              const gradeRationale = getGradeRationale(cit.evidence_grade);

              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2.5"
                >
                  {/* Top: Chunk ID and Grade Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-sky-300 font-mono text-[11px] font-semibold">
                      {cit.chunk_id}
                    </span>
                    <span
                      className={`text-[9.5px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                        cit.evidence_grade === 'A'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                          : cit.evidence_grade === 'B+'
                          ? 'bg-sky-950 text-sky-300 border-sky-700/60'
                          : cit.evidence_grade === 'B'
                          ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      Grade {cit.evidence_grade}
                    </span>
                  </div>

                  {/* Locator details */}
                  <div className="text-[10px] font-mono text-slate-400 flex items-center space-x-2">
                    <span>Book: <strong className="text-slate-300">{cit.book}</strong></span>
                    {cit.page !== undefined && <span>Page: <strong className="text-slate-300">{cit.page}</strong></span>}
                    {cit.section && <span>Section: <strong className="text-slate-300">{cit.section}</strong></span>}
                  </div>

                  {/* One-line Grade Rationale (Guardrail 5) */}
                  <div className="text-[10px] font-mono text-slate-400 bg-slate-900 p-1.5 rounded border border-slate-800">
                    {gradeRationale}
                  </div>

                  {/* Verbatim Quote Substring */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-mono text-slate-400">
                      Machine-Verified Quote Substring:
                    </div>
                    <blockquote className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 font-mono leading-relaxed border-l-2 border-l-sky-400">
                      "{cit.quote}"
                    </blockquote>
                  </div>

                  {/* Full Chunk Text in ambient context */}
                  {fullText && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400">
                        Full Chunk Text:
                      </div>
                      <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800/80 text-[10px] text-slate-300 font-mono max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {fullText}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {selectedEdge.evidence.length === 0 && (
              <div className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-400 font-mono text-xs italic">
                No direct citations attached to this relation (Used for absence / missing-evidence testing).
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // Render when NODE is selected
  if (selectedNode) {
    // Find connected edges
    const outgoingEdges = allEdges.filter((e) => e.src === selectedNode.id);
    const incomingEdges = allEdges.filter((e) => e.dst === selectedNode.id);

    // Compute compatibility report if a target component is chosen
    const candidateTargets = allNodes.filter(
      (n) => n.id !== selectedNode.id && (n.type === 'component' || n.type === 'standard' || n.type === 'unknown_requirement')
    );

    const compatibilityReport: CompatibilityReport | null = targetComponentId
      ? evaluateCompatibility(selectedNode.id, targetComponentId)
      : null;

    return (
      <aside className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full overflow-hidden select-none">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {selectedNode.type}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {selectedNode.subsystem}
              </span>
              {selectedNode.batch && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                  {selectedNode.batch}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
              {selectedNode.name}
            </h2>
            <div className="text-[10px] font-mono text-slate-400">
              {selectedNode.id}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Canonical Node Description (Guardrail 1: Frozen Canonical Text) */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
              Canonical Description
            </span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {selectedNode.description || 'No description provided.'}
            </p>
          </div>

          {/* Node Properties */}
          {(() => {
            const propList = Object.values(selectedNode.properties || {});
            if (propList.length === 0) return null;
            return (
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
                  Mechanical Properties ({propList.length})
                </span>
                <div className="space-y-2">
                  {propList.map((prop, pi) => (
                    <div
                      key={pi}
                      className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-sky-300 font-semibold text-[11px]">
                          {prop.name || prop.key}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                            prop.status === 'verified'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-amber-950 text-amber-400'
                          }`}
                        >
                          {prop.status}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-200">
                        <strong>Value:</strong> {String(prop.value)}{' '}
                        {prop.unit && <span className="text-slate-400">{prop.unit}</span>}
                      </div>

                      {(prop.status === 'needs_review' || Boolean(prop.note)) && (
                        <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                          <strong>Review Note:</strong> {prop.note || 'Review required'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ConstraintEngine Compatibility Evaluator (Guardrail 2: Strict Engine Verdict) */}
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Constraint Engine Fitment</span>
              </span>
              <p className="text-[10.5px] text-slate-400">
                Evaluates constraints via rule engine with zero fabricated claims.
              </p>
            </div>

            {/* Target component selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">
                Select Target Component to Test:
              </label>
              <select
                value={targetComponentId}
                onChange={(e) => setTargetComponentId(e.target.value)}
                className="w-full text-xs font-mono bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">-- Choose Target Entity --</option>
                {candidateTargets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Evaluation Result */}
            {compatibilityReport && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    Engine Verdict:
                  </span>
                  {renderVerdictBadge(compatibilityReport.verdict)}
                </div>

                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-200">
                  {compatibilityReport.overall_explanation}
                </div>

                {/* Constraint Rule Breakdown */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    Constraint Evaluations:
                  </span>
                  {compatibilityReport.evaluations.map((ev: ConstraintEvaluation, ei: number) => (
                    <div
                      key={ei}
                      className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[10.5px] font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-300">{ev.rule_name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                            ev.passed
                              ? 'bg-emerald-950 text-emerald-400'
                              : ev.state === 'incompatible'
                              ? 'bg-rose-950 text-rose-400'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ev.state}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[10px]">{ev.reason}</p>

                      {ev.conditions && ev.conditions.length > 0 && (
                        <div className="text-amber-400 text-[9.5px]">
                          Condition: {ev.conditions.join(', ')}
                        </div>
                      )}

                      {ev.evidence_citations && ev.evidence_citations.length > 0 && (
                        <div className="pt-1 text-[9.5px] text-sky-400">
                          {ev.evidence_citations.map((c: EvidenceCitation, ci: number) => (
                            <div key={ci} className="truncate">
                              • {c.chunk_id} ({c.evidence_grade}): "{c.quote.slice(0, 50)}..."
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Node Evidence Citations */}
          {selectedNode.evidence && selectedNode.evidence.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Node Provenance Citations ({selectedNode.evidence.length})</span>
              </span>
              <div className="space-y-2">
                {selectedNode.evidence.map((cit, ci) => (
                  <div
                    key={ci}
                    className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[10.5px]">
                      <span className="text-sky-300 font-semibold">{cit.chunk_id}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase">
                        Grade {cit.evidence_grade}
                      </span>
                    </div>
                    <blockquote className="text-[10.5px] font-mono text-slate-300 italic border-l border-sky-500 pl-2">
                      "{cit.quote}"
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Graph Edges */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
              Connected Relations ({outgoingEdges.length + incomingEdges.length})
            </span>

            {outgoingEdges.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Outgoing:</div>
                {outgoingEdges.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEdge(e.id)}
                    className="w-full text-left p-2 rounded bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between text-xs font-mono transition"
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-sky-400">── {e.type} ──▶</span>
                      <span className="text-slate-200 truncate">{e.dst}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {incomingEdges.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Incoming:</div>
                {incomingEdges.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEdge(e.id)}
                    className="w-full text-left p-2 rounded bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between text-xs font-mono transition"
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-slate-200 truncate">{e.src}</span>
                      <span className="text-emerald-400">── {e.type} ──▶</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // Default Empty State
  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full overflow-hidden select-none p-5 text-center justify-center space-y-3">
      <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
        <Info className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Interactive Inspector</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Select any node or relation edge in the canvas to inspect evidence provenance, mechanical properties, and run ConstraintEngine fitment checks.
        </p>
      </div>
      <div className="pt-2 text-[11px] font-mono text-slate-500 border-t border-slate-800">
        Canonical Knowledge Graph • 27 Nodes • 12 Edges • 59 Verified Quotes
      </div>
    </aside>
  );
}
