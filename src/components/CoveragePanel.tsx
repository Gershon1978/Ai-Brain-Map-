/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { computeCoverageReport } from '../services/coverage-service.ts';
import {
  X,
  ShieldCheck,
  Layers,
  GitFork,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface CoveragePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export function CoveragePanel({ isOpen, onClose, onSelectNode }: CoveragePanelProps) {
  const report = useMemo(() => computeCoverageReport(), [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                Coverage & Integrity Report
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  Computed Runtime Telemetry
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Live verification metrics evaluated directly from seed, registered expansions, and bundled evidence.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-sans">
          {/* Ceiling Statement Banner */}
          <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-300">Corpus Ceiling Reached</div>
              <p className="text-[11.5px] leading-relaxed text-amber-200/90">
                {report.ceilingSentence}
              </p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Entities</span>
              <div className="text-xl font-bold font-mono text-white flex items-baseline gap-2">
                <span>{report.totals.nodes}</span>
                <span className="text-xs font-normal text-slate-400">nodes</span>
                <span className="text-slate-600">/</span>
                <span>{report.totals.edges}</span>
                <span className="text-xs font-normal text-slate-400">edges</span>
              </div>
              <div className="text-[10.5px] text-slate-400 flex gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-emerald-400 font-mono">{report.nodeStatusSplit.verified} ver</span>
                <span>•</span>
                <span className="text-amber-400 font-mono">{report.nodeStatusSplit.candidate} cand</span>
                <span>•</span>
                <span className="text-rose-400 font-mono">{report.nodeStatusSplit.needs_review} rev</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Edge Verification</span>
              <div className="text-xl font-bold font-mono text-white">
                <span className="text-emerald-400">{report.edgeStatusSplit.verified}</span>
                <span className="text-xs font-normal text-slate-400"> verified</span>
              </div>
              <div className="text-[10.5px] text-slate-400 flex gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-rose-400 font-mono">{report.edgeStatusSplit.needs_review} needs_review</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Citations</span>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {report.citations.total}
              </div>
              <div className="text-[10.5px] text-slate-400 flex gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-emerald-400 font-mono">{report.citations.byteExact} byte-exact</span>
                <span>•</span>
                <span className="text-sky-300 font-mono">{report.citations.whitespaceOnly} ws-only</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Chunk Coverage</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {report.chunkCoverage.citedDistinctCount} / {report.chunkCoverage.totalBundledCount}
              </div>
              <div className="text-[10.5px] text-emerald-400/90 flex gap-1 pt-1 border-t border-slate-800/60 items-center">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{report.chunkCoverage.unusedCount} unused chunks</span>
              </div>
            </div>
          </div>

          {/* Per-Batch Ledger */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Per-Batch Ledger (Distinct Top-Level Batches)</span>
            </h3>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Batch Identifier</th>
                    <th className="py-2 px-3 text-right">Nodes</th>
                    <th className="py-2 px-3 text-right">Edges</th>
                    <th className="py-2 px-3 text-right">Citations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report.batchLedger.map((row) => (
                    <tr key={row.batch} className="hover:bg-slate-900/50 transition">
                      <td className="py-1.5 px-3 font-medium text-slate-200">{row.batch}</td>
                      <td className="py-1.5 px-3 text-right text-slate-300">{row.nodes}</td>
                      <td className="py-1.5 px-3 text-right text-slate-300">{row.edges}</td>
                      <td className="py-1.5 px-3 text-right text-cyan-400">{row.citations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Citations Fidelity & Chunk Coverage Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Citation Fidelity Breakdown</span>
              </h3>
              <p className="text-slate-400 text-[11.5px] leading-relaxed">
                All <span className="font-mono text-slate-200 font-semibold">{report.citations.total}</span> citations across nodes and edges are verified against the corpus:
              </p>
              <ul className="space-y-1.5 font-mono text-[11px]">
                <li className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-emerald-300">Byte-for-byte exact matches:</span>
                  <span className="font-bold text-emerald-400">{report.citations.byteExact}</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-sky-300">Matches after whitespace collapsed (frozen seed):</span>
                  <span className="font-bold text-sky-400">{report.citations.whitespaceOnly}</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                <GitFork className="w-3.5 h-3.5 text-emerald-400" />
                <span>Graph Connectivity &amp; Islands</span>
              </h3>
              <p className="text-slate-400 text-[11.5px] leading-relaxed">
                Total components: <span className="font-mono text-slate-200 font-semibold">{report.connectivity.componentCount}</span>.
                Largest main component contains <span className="font-mono text-emerald-400 font-semibold">{report.connectivity.largestSize} nodes</span> ({report.connectivity.largestPercentage}% of graph).
              </p>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Remaining 6 Islands:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {report.connectivity.remainingIslands.map((island) => (
                    <button
                      key={island.exampleNodeId}
                      onClick={() => {
                        if (onSelectNode) onSelectNode(island.exampleNodeId);
                        onClose();
                      }}
                      className="p-1.5 rounded bg-slate-900 border border-slate-800 text-left hover:border-slate-700 transition flex items-center justify-between"
                      title={`Inspect island containing ${island.exampleNodeId}`}
                    >
                      <span className="font-mono text-[10.5px] text-slate-300 truncate">{island.exampleNodeId}</span>
                      <span className="font-mono text-[10px] text-purple-400 px-1 py-0.2 rounded bg-purple-950/60 border border-purple-800/40 shrink-0 ml-1">
                        size {island.size}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center text-xs text-slate-400 font-mono">
          <span>Integrity Verification Engine • Phase 6 Complete</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
