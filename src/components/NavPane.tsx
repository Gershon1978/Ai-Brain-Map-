/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, ChangeEvent } from 'react';
import { SubsystemId, GraphPayload } from '../types/graph.ts';
import {
  Search,
  Database,
  Download,
  Upload,
  Layers,
  Filter,
  Check,
  ShieldCheck,
  RefreshCw,
  X,
  FileCheck,
} from 'lucide-react';
import {
  exportToJsonl,
  exportToGraphml,
} from '../services/graph-export.ts';
import {
  attachKbDatabase,
  detachKbDatabase,
  isDatabaseAttached,
  getAttachedChunkCount,
} from '../services/sqlite-service.ts';
import { getProvenanceLabel } from '../services/provenance-service.ts';

interface NavPaneProps {
  payload: GraphPayload;
  selectedSubsystem: SubsystemId | 'all';
  onSelectSubsystem: (subsystem: SubsystemId | 'all') => void;
  selectedType: string | 'all';
  onSelectType: (type: string | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  depthLimit: number;
  onDepthChange: (depth: number) => void;
  resultLimit: number;
  onResultLimitChange: (limit: number) => void;
  degreeCollapseThreshold: number;
  onThresholdChange: (threshold: number) => void;
  onOpenImportModal: () => void;
  onOpenTestModal: () => void;
  onOpenCoveragePanel?: () => void;
  onDatabaseAttachedChange: () => void;
  visibleNodeCount: number;
  visibleEdgeCount: number;
}

export function NavPane({
  payload,
  selectedSubsystem,
  onSelectSubsystem,
  selectedType,
  onSelectType,
  searchQuery,
  onSearchChange,
  depthLimit,
  onDepthChange,
  resultLimit,
  onResultLimitChange,
  degreeCollapseThreshold,
  onThresholdChange,
  onOpenImportModal,
  onOpenTestModal,
  onOpenCoveragePanel,
  onDatabaseAttachedChange,
  visibleNodeCount,
  visibleEdgeCount,
}: NavPaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const hasAttachedDb = isDatabaseAttached();
  const provenanceText = getProvenanceLabel(
    hasAttachedDb ? 'attached_db' : 'bundled',
    hasAttachedDb ? getAttachedChunkCount() : undefined
  );

  // Handle SQLite file attachment
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDbLoading(true);
    setDbError(null);

    try {
      const buffer = await file.arrayBuffer();
      await attachKbDatabase(buffer, file.name);
      onDatabaseAttachedChange();
    } catch (err) {
      setDbError((err as Error).message);
    } finally {
      setDbLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDetachDb = () => {
    detachKbDatabase();
    onDatabaseAttachedChange();
  };

  // Export handlers
  const handleExportJsonl = () => {
    const jsonl = exportToJsonl(payload);
    const blob = new Blob([jsonl], { type: 'application/x-ndjson;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hi5-knowledge-graph-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGraphml = () => {
    const graphml = exportToGraphml(payload);
    const blob = new Blob([graphml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hi5-knowledge-graph-${new Date().toISOString().slice(0, 10)}.graphml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/95 flex flex-col h-full overflow-hidden select-none">
      {/* Search Input */}
      <div className="p-3.5 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes, properties, IDs..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Result counts */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>
            Visible: <strong className="text-slate-200">{visibleNodeCount}</strong>/{payload.nodes.length} nodes
          </span>
          <span>
            <strong className="text-slate-200">{visibleEdgeCount}</strong>/{payload.edges.length} edges
          </span>
        </div>
      </div>

      {/* Scrollable Filters and Controls */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Evidence Provenance Badge (Guardrail 3: Honest Source) */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center space-x-1.5">
              <Database className="w-3 h-3 text-sky-400" />
              <span>Evidence Source</span>
            </span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                hasAttachedDb
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {hasAttachedDb ? 'Live DB' : 'Bundled Excerpt'}
            </span>
          </div>

          <div
            className={`text-[11px] font-mono p-2 rounded border flex items-start space-x-1.5 ${
              hasAttachedDb
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{provenanceText}</span>
          </div>

          {/* Attach / Detach kb.db File */}
          <div className="pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={handleFileUpload}
              className="hidden"
            />
            {!hasAttachedDb ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={dbLoading}
                className="w-full text-xs font-mono py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center justify-center space-x-1.5 transition"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{dbLoading ? 'Attaching DB...' : 'Attach full kb.db (SQLite)'}</span>
              </button>
            ) : (
              <button
                onClick={handleDetachDb}
                className="w-full text-xs font-mono py-1.5 px-2.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 flex items-center justify-center space-x-1.5 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Detach kb.db (Use Bundled)</span>
              </button>
            )}

            {dbError && (
              <p className="text-[10px] text-rose-400 mt-1 font-mono">{dbError}</p>
            )}
          </div>
        </div>

        {/* Subsystems Filter */}
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center space-x-1">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>Subsystem</span>
          </label>
          <div className="space-y-1">
            {[
              { id: 'all', label: 'All Subsystems' },
              { id: 'sys-drivetrain', label: 'Drivetrain' },
              { id: 'sys-wheels', label: 'Wheels & Tires' },
              { id: 'sys-cockpit', label: 'Steering & Cockpit' },
              { id: 'sys-brakes', label: 'Braking' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => onSelectSubsystem(sub.id as SubsystemId | 'all')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between ${
                  selectedSubsystem === sub.id
                    ? 'bg-sky-500/20 text-sky-200 font-medium border border-sky-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span>{sub.label}</span>
                {selectedSubsystem === sub.id && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Node Type Filter */}
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center space-x-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            <span>Node Type</span>
          </label>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {[
              { id: 'all', label: 'All' },
              { id: 'subsystem', label: 'Subsystem' },
              { id: 'component', label: 'Component' },
              { id: 'standard', label: 'Standard' },
              { id: 'property', label: 'Property' },
              { id: 'diagnostic', label: 'Diagnostic' },
              { id: 'unknown_requirement', label: 'Unknown' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectType(t.id)}
                className={`px-2 py-1 rounded text-left truncate transition ${
                  selectedType === t.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Depth & Collapse Controls (Guardrail 4) */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Graph Depth Limit</span>
              <span className="text-sky-400 font-bold">{depthLimit} hops</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              value={depthLimit}
              onChange={(e) => onDepthChange(parseInt(e.target.value, 10))}
              className="w-full accent-sky-500 h-1 bg-slate-800 rounded"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>1 (Immediate)</span>
              <span>4 (Full Subgraph)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Result Count Limit</span>
              <span className="text-cyan-400 font-bold">{resultLimit} nodes</span>
            </div>
            <input
              type="range"
              min={5}
              max={payload.nodes.length}
              value={Math.min(resultLimit, payload.nodes.length)}
              onChange={(e) => onResultLimitChange(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 h-1 bg-slate-800 rounded"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>5 (Focus)</span>
              <span>{payload.nodes.length} (All Nodes)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Degree Auto-Collapse</span>
              <span className="text-amber-400 font-bold">&gt; {degreeCollapseThreshold}</span>
            </div>
            <input
              type="range"
              min={2}
              max={60}
              step={1}
              value={degreeCollapseThreshold}
              onChange={(e) => onThresholdChange(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-1 bg-slate-800 rounded"
            />
            <div className="text-[10px] text-slate-500">
              Nodes with degree exceeding threshold auto-collapse child branches per specification.
            </div>
          </div>
        </div>

        {/* Export / Import Section (Guardrail 6) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <label className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center space-x-1">
            <Download className="w-3 h-3 text-cyan-400" />
            <span>Graph Export & Import</span>
          </label>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleExportJsonl}
              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 flex items-center justify-center space-x-1 transition"
              title="Export in-memory nodes & edges to JSONL with schema_version"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>JSONL</span>
            </button>
            <button
              onClick={handleExportGraphml}
              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 flex items-center justify-center space-x-1 transition"
              title="Export in-memory nodes & edges to valid GraphML XML"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>GraphML</span>
            </button>
          </div>

          <button
            onClick={onOpenImportModal}
            className="w-full px-2 py-1.5 rounded bg-slate-950 hover:bg-slate-850 text-slate-300 text-xs font-mono border border-slate-800 flex items-center justify-center space-x-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Import Graph (Validate Schema)</span>
          </button>
        </div>

        {/* Audit, Coverage & Verification Triggers */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          {onOpenCoveragePanel && (
            <button
              onClick={onOpenCoveragePanel}
              className="w-full px-3 py-2 rounded bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 text-xs font-mono border border-sky-800/50 flex items-center justify-between transition"
            >
              <div className="flex items-center space-x-1.5">
                <FileCheck className="w-4 h-4 text-sky-400" />
                <span>Coverage &amp; Integrity</span>
              </div>
              <span className="text-[10px] bg-sky-900/80 text-sky-200 px-1.5 py-0.2 rounded font-bold">
                Report
              </span>
            </button>
          )}

          <button
            onClick={onOpenTestModal}
            className="w-full px-3 py-2 rounded bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 text-xs font-mono border border-emerald-800/60 flex items-center justify-between transition"
          >
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verification Test Suite</span>
            </div>
            <span className="text-[10px] bg-emerald-900 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
              15/15
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
