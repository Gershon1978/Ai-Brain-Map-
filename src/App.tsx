/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { getMergedGraph, getDerivedSubtitle } from './services/graph-loader.ts';
import { GraphPayload, SubsystemId } from './types/graph.ts';
import { calculateHybridLayout } from './services/hybrid-layout.ts';
import { GraphCanvas } from './components/GraphCanvas.tsx';
import { NavPane } from './components/NavPane.tsx';
import { DetailPane } from './components/DetailPane.tsx';
import { ImportModal } from './components/ImportModal.tsx';
import { TestSuiteModal } from './components/TestSuiteModal.tsx';
import { CoveragePanel } from './components/CoveragePanel.tsx';
import { isDatabaseAttached, getAttachedChunkCount } from './services/sqlite-service.ts';
import { getProvenanceLabel } from './services/provenance-service.ts';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';

export default function App() {
  // Graph payload state (merges frozen seed graph + Phase 5 expansion)
  const [graphPayload, setGraphPayload] = useState<GraphPayload>(() => getMergedGraph());

  // Coverage panel state
  const [isCoveragePanelOpen, setIsCoveragePanelOpen] = useState(false);

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('comp-cassette');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Filter & control states
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemId | 'all'>('all');
  const [selectedType, setSelectedType] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [depthLimit, setDepthLimit] = useState<number>(4);
  const [resultLimit, setResultLimit] = useState<number>(() => getMergedGraph().nodes.length);
  const [degreeCollapseThreshold, setDegreeCollapseThreshold] = useState<number>(40);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // SQLite database attachment tracking trigger
  const [dbStateVersion, setDbStateVersion] = useState(0);

  // Handlers for node/edge selection
  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const handleSelectEdge = (id: string | null) => {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
  };

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Re-run layout calculation when inputs change
  const layout = useMemo(() => {
    return calculateHybridLayout(graphPayload.nodes, graphPayload.edges, {
      selectedNodeId,
      depthLimit,
      resultLimit,
      searchQuery,
      subsystemFilter: selectedSubsystem,
      typeFilter: selectedType,
      degreeCollapseThreshold,
      collapsedNodes,
    });
  }, [
    graphPayload,
    selectedNodeId,
    depthLimit,
    resultLimit,
    searchQuery,
    selectedSubsystem,
    selectedType,
    degreeCollapseThreshold,
    collapsedNodes,
  ]);

  // Selected node / edge objects
  const selectedNode = useMemo(() => {
    return graphPayload.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graphPayload, selectedNodeId]);

  const selectedEdge = useMemo(() => {
    return graphPayload.edges.find((e) => e.id === selectedEdgeId) || null;
  }, [graphPayload, selectedEdgeId]);

  // Provenance text for top header
  const hasDbAttached = useMemo(() => {
    // dbStateVersion triggers re-evaluation when sqlite attachment changes
    return dbStateVersion >= 0 && isDatabaseAttached();
  }, [dbStateVersion]);

  const provenanceLabel = useMemo(() => {
    return getProvenanceLabel(
      hasDbAttached ? 'attached_db' : 'bundled',
      hasDbAttached ? getAttachedChunkCount() : undefined
    );
  }, [hasDbAttached]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top Main Application Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm font-mono">
            H5
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold text-slate-100 tracking-tight">
                Hi5 Mechanical Knowledge Graph
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800/40 font-bold">
                PHASE 5 EXPLORER
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 font-mono">
              {getDerivedSubtitle()}
            </p>
          </div>
        </div>

        {/* Top Badges: Frozen Data & Honest Provenance Status */}
        <div className="flex items-center space-x-2.5 text-xs font-mono">
          <button
            onClick={() => setIsCoveragePanelOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-sky-950/80 border border-sky-600/50 text-sky-300 hover:bg-sky-900/70 hover:text-white transition shadow-sm"
            title="Open Coverage & Integrity report"
          >
            <FileCheck className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold text-[11px]">Coverage &amp; Integrity</span>
          </button>

          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>{graphPayload.nodes.length} Nodes</span>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>{graphPayload.edges.length} Edges</span>
          </div>

          {/* Honest Provenance Badge (Guardrail 3) */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border ${
              hasDbAttached
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium">{provenanceLabel}</span>
          </div>
        </div>
      </header>

      {/* Main 3-Pane Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PANE 1 (LEFT): Nav, Search, Filters, Provenance, Export/Import */}
        <NavPane
          payload={graphPayload}
          selectedSubsystem={selectedSubsystem}
          onSelectSubsystem={setSelectedSubsystem}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          depthLimit={depthLimit}
          onDepthChange={setDepthLimit}
          resultLimit={resultLimit}
          onResultLimitChange={setResultLimit}
          degreeCollapseThreshold={degreeCollapseThreshold}
          onThresholdChange={setDegreeCollapseThreshold}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onOpenTestModal={() => setIsTestModalOpen(true)}
          onOpenCoveragePanel={() => setIsCoveragePanelOpen(true)}
          onDatabaseAttachedChange={() => setDbStateVersion((v) => v + 1)}
          visibleNodeCount={layout.visibleCount.nodes}
          visibleEdgeCount={layout.visibleCount.edges}
        />

        {/* PANE 2 (CENTRE): Interactive Hybrid Layout Graph Canvas */}
        <main className="flex-1 h-full overflow-hidden relative">
          <GraphCanvas
            layout={layout}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onToggleCollapse={handleToggleCollapse}
            rawNodes={graphPayload.nodes}
            rawEdges={graphPayload.edges}
          />
        </main>

        {/* PANE 3 (RIGHT): Pinned Detail & Evidence Viewer Pane */}
        <DetailPane
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          allNodes={graphPayload.nodes}
          allEdges={graphPayload.edges}
          onSelectNode={handleSelectNode}
          onSelectEdge={handleSelectEdge}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
        />
      </div>

      {/* Modals & Panels */}
      <CoveragePanel
        isOpen={isCoveragePanelOpen}
        onClose={() => setIsCoveragePanelOpen(false)}
        onSelectNode={handleSelectNode}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(newPayload) => {
          setGraphPayload(newPayload);
          setSelectedNodeId(newPayload.nodes[0]?.id || null);
          setSelectedEdgeId(null);
        }}
      />

      <TestSuiteModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </div>
  );
}
