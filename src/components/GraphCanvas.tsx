/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useMemo } from 'react';
import { GraphNode, GraphEdge } from '../types/graph.ts';
import { LayoutResult, LayoutNode } from '../services/hybrid-layout.ts';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

interface GraphCanvasProps {
  layout: LayoutResult;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onToggleCollapse: (id: string) => void;
  rawNodes: GraphNode[];
  rawEdges: GraphEdge[];
}

export function GraphCanvas({
  layout,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onToggleCollapse,
  rawNodes,
  rawEdges,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 40, y: 30, scale: 0.85 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging individual node
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nodeCustomPositions, setNodeCustomPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Reset positions when filter changes or on user demand
  const handleResetView = () => {
    setTransform({ x: 40, y: 30, scale: 0.85 });
    setNodeCustomPositions(new Map());
  };

  // Center fit
  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 80) / layout.bounds.width;
    const scaleY = (rect.height - 80) / layout.bounds.height;
    const scale = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)));
    const x = (rect.width - layout.bounds.width * scale) / 2 - layout.bounds.minX * scale;
    const y = 40;
    setTransform({ x, y, scale });
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(2.5, prev.scale + delta)),
    }));
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoom(zoomFactor);
  };

  // Canvas Mouse Down (Pan)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only if clicking directly on SVG canvas, not a node
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'canvas-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    } else if (draggedNodeId) {
      const newX = (e.clientX - transform.x) / transform.scale - dragOffset.x;
      const newY = (e.clientY - transform.y) / transform.scale - dragOffset.y;
      setNodeCustomPositions((prev) => {
        const next = new Map(prev);
        next.set(draggedNodeId, { x: newX, y: newY });
        return next;
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - transform.x) / transform.scale - currentX,
      y: (e.clientY - transform.y) / transform.scale - currentY,
    });
    onSelectNode(nodeId);
  };

  // Connected nodes & edges calculation for highlighting
  const connectedContext = useMemo(() => {
    const activeNodeId = hoveredNodeId || selectedNodeId;
    if (!activeNodeId) return null;

    const nodeIds = new Set<string>([activeNodeId]);
    const edgeIds = new Set<string>();

    for (const e of rawEdges) {
      if (e.src === activeNodeId || e.dst === activeNodeId) {
        edgeIds.add(e.id);
        nodeIds.add(e.src);
        nodeIds.add(e.dst);
      }
    }

    return { nodeIds, edgeIds };
  }, [hoveredNodeId, selectedNodeId, rawEdges]);

  // Helper to get actual node position (custom or layout)
  const getNodePosition = (node: LayoutNode) => {
    const custom = nodeCustomPositions.get(node.id);
    return custom ? custom : { x: node.x, y: node.y };
  };

  // Node Type styling mapping (color + shape + border style)
  const getNodeStyling = (type: string, isSelected: boolean, isDimmed: boolean) => {
    let border = 'border-slate-700 bg-slate-900';
    let text = 'text-slate-200';
    let badge = 'bg-slate-800 text-slate-300';
    let shape = 'rounded-md';

    switch (type) {
      case 'subsystem':
        border = isSelected
          ? 'border-purple-400 bg-purple-950/80 ring-2 ring-purple-400'
          : 'border-purple-600/60 bg-purple-950/40 text-purple-200';
        text = 'text-purple-200 font-bold';
        badge = 'bg-purple-900/60 text-purple-300 border border-purple-700/50';
        shape = 'rounded-lg border-2';
        break;
      case 'component':
        border = isSelected
          ? 'border-sky-400 bg-sky-950/80 ring-2 ring-sky-400'
          : 'border-sky-600/50 bg-slate-900 text-sky-200';
        text = 'text-slate-100 font-semibold';
        badge = 'bg-sky-950/80 text-sky-300 border border-sky-800/40';
        shape = 'rounded-md';
        break;
      case 'standard':
        border = isSelected
          ? 'border-emerald-400 bg-emerald-950/80 ring-2 ring-emerald-400'
          : 'border-emerald-600/50 bg-emerald-950/30 text-emerald-200';
        text = 'text-emerald-200 font-semibold';
        badge = 'bg-emerald-950 text-emerald-300 border border-emerald-800/40';
        shape = 'rounded-md border-dashed';
        break;
      case 'property':
        border = isSelected
          ? 'border-amber-400 bg-amber-950/80 ring-2 ring-amber-400'
          : 'border-amber-600/50 bg-amber-950/20 text-amber-200';
        text = 'text-amber-200 font-medium';
        badge = 'bg-amber-950 text-amber-300 border border-amber-800/40';
        shape = 'rounded-full px-3';
        break;
      case 'diagnostic':
        border = isSelected
          ? 'border-rose-400 bg-rose-950/80 ring-2 ring-rose-400'
          : 'border-rose-600/50 bg-rose-950/30 text-rose-200';
        text = 'text-rose-200 font-semibold';
        badge = 'bg-rose-950 text-rose-300 border border-rose-800/40';
        shape = 'rounded-md';
        break;
      case 'unknown_requirement':
        border = isSelected
          ? 'border-slate-300 bg-slate-800 ring-2 ring-slate-300'
          : 'border-slate-500/60 bg-slate-900/60 text-slate-300 border-dashed';
        text = 'text-slate-300 italic';
        badge = 'bg-slate-800 text-slate-400 border border-slate-700';
        shape = 'rounded-md border-2 border-dotted';
        break;
    }

    const opacity = isDimmed ? 'opacity-30' : 'opacity-100';
    return { border, text, badge, shape, opacity };
  };

  // Edge styling mapping
  const getEdgeStyling = (type: string, isSelected: boolean, isDimmed: boolean, isHovered: boolean = false) => {
    let stroke = '#64748b'; // slate-500
    let strokeWidth = isSelected ? 3 : (isHovered ? 2.5 : 1.75);
    let strokeDasharray = 'none';
    let labelBg = 'bg-slate-800 border-slate-700 text-slate-300';

    switch (type) {
      case 'contains':
        stroke = isSelected ? '#38bdf8' : '#0284c7'; // sky
        labelBg = 'bg-sky-950 border-sky-800 text-sky-300';
        break;
      case 'part_of':
        stroke = isSelected ? '#818cf8' : '#4f46e5'; // indigo
        labelBg = 'bg-indigo-950 border-indigo-800 text-indigo-300';
        break;
      case 'fits':
      case 'fits_into':
        stroke = isSelected ? '#34d399' : '#059669'; // emerald
        strokeWidth = isSelected ? 3.5 : 2;
        labelBg = 'bg-emerald-950 border-emerald-800 text-emerald-300';
        break;
      case 'incompatible_with':
        stroke = isSelected ? '#f87171' : '#dc2626'; // red
        strokeDasharray = '6 4';
        strokeWidth = isSelected ? 3.5 : 2.25;
        labelBg = 'bg-rose-950 border-rose-700 text-rose-300';
        break;
      case 'requires':
        stroke = isSelected ? '#fbbf24' : '#d97706'; // amber
        strokeDasharray = '4 2';
        labelBg = 'bg-amber-950 border-amber-800 text-amber-300';
        break;
      case 'interfaces_with':
        stroke = isSelected ? '#60a5fa' : '#2563eb'; // blue
        labelBg = 'bg-blue-950 border-blue-800 text-blue-300';
        break;
      case 'mounted_on':
        stroke = isSelected ? '#38bdf8' : '#0284c7'; // sky
        labelBg = 'bg-sky-950 border-sky-800 text-sky-300';
        break;
      case 'affects':
      case 'constrains':
        stroke = isSelected ? '#f59e0b' : '#b45309'; // amber
        strokeDasharray = '5 3';
        labelBg = 'bg-amber-950 border-amber-800 text-amber-300';
        break;
      case 'conforms_to':
        stroke = isSelected ? '#2dd4bf' : '#0d9488'; // teal
        labelBg = 'bg-teal-950 border-teal-800 text-teal-300';
        break;
      case 'indicates':
        stroke = isSelected ? '#c084fc' : '#9333ea'; // purple
        labelBg = 'bg-purple-950 border-purple-800 text-purple-300';
        break;
      case 'defines':
        stroke = isSelected ? '#38bdf8' : '#0ea5e9'; // sky
        labelBg = 'bg-sky-950 border-sky-800 text-sky-300';
        break;
      case 'unknown_due_to_missing_evidence':
      case 'has_unknown':
        stroke = isSelected ? '#94a3b8' : '#64748b'; // slate
        strokeDasharray = '3 3';
        labelBg = 'bg-slate-900 border-slate-700 text-slate-400';
        break;
    }

    const opacity = isDimmed ? 0.15 : 1;
    return { stroke, strokeWidth, strokeDasharray, labelBg, opacity };
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full bg-slate-950 overflow-hidden select-none"
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Grid Pattern */}
      <div
        id="canvas-bg"
        className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-auto"
      />

      {/* Top Floating Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg shadow-lg">
        <button
          onClick={() => handleZoom(0.15)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Reset Graph Layout"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        <div className="text-[11px] font-mono text-slate-400 px-2">
          Zoom: {Math.round(transform.scale * 100)}%
        </div>
      </div>

      {/* Subsystem Column Headers (Layered Architecture Indicators) */}
      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 text-[11px] font-mono">
        <span className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-slate-400">
          Showing <strong className="text-slate-100">{layout.visibleCount.nodes}</strong> nodes,{' '}
          <strong className="text-slate-100">{layout.visibleCount.edges}</strong> edges
        </span>
      </div>

      {/* Main SVG Graph Layer */}
      <svg
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          {/* Arrowhead markers for different edge types */}
          <marker
            id="arrow-contains"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
          </marker>
          <marker
            id="arrow-part_of"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5" />
          </marker>
          <marker
            id="arrow-fits"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
          </marker>
          <marker
            id="arrow-incompatible"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
          </marker>
          <marker
            id="arrow-cross"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Column boundary guides for Subsystem tiers */}
        {['Drivetrain', 'Steering & Headset', 'Cockpit & Controls', 'Braking'].map((colName, idx) => {
          const colX = 80 + idx * 340;
          return (
            <g key={colName} opacity={0.35}>
              <line
                x1={colX + 320}
                y1={40}
                x2={colX + 320}
                y2={layout.bounds.height + 40}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <text
                x={colX + 160}
                y={60}
                textAnchor="middle"
                fill="#64748b"
                fontSize={12}
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="1"
              >
                // {colName.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* 1. EDGES */}
        {layout.edges.map((edge) => {
          if (!edge.visible) return null;
          const srcNode = layout.nodes.get(edge.src);
          const dstNode = layout.nodes.get(edge.dst);
          if (!srcNode || !dstNode) return null;

          const p1 = getNodePosition(srcNode);
          const p2 = getNodePosition(dstNode);

          const isSelected = selectedEdgeId === edge.id;
          const isHovered = hoveredEdgeId === edge.id;
          const isDimmed = Boolean(
            connectedContext && !connectedContext.edgeIds.has(edge.id)
          );
          const edgeStyle = getEdgeStyling(edge.type, isSelected, isDimmed, isHovered);

          // Calculate curve path
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;

          // For layered edges (contains / part_of): direct vertical bezier curve
          // For cross-links: curved arch
          let pathD = '';
          if (edge.isLayered) {
            const cpY1 = p1.y + dy * 0.5;
            const cpY2 = p1.y + dy * 0.5;
            pathD = `M ${p1.x} ${p1.y + 25} C ${p1.x} ${cpY1}, ${p2.x} ${cpY2}, ${p2.x} ${p2.y - 25}`;
          } else {
            // Lateral cross-link: curve slightly outward or upward
            const curveOffset = Math.abs(dx) > 100 ? 40 : 20;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2 - curveOffset;
            pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;
          }

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2 - (edge.isLayered ? 0 : 20);

          return (
            <g
              key={edge.id}
              className="cursor-pointer transition-opacity duration-200"
              style={{ opacity: edgeStyle.opacity }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
              onMouseEnter={() => setHoveredEdgeId(edge.id)}
              onMouseLeave={() => setHoveredEdgeId(null)}
            >
              {/* Invisible wide stroke for easy clicking */}
              <path d={pathD} fill="none" stroke="transparent" strokeWidth={18} />

              {/* Visible edge line */}
              <path
                d={pathD}
                fill="none"
                stroke={edgeStyle.stroke}
                strokeWidth={edgeStyle.strokeWidth}
                strokeDasharray={edgeStyle.strokeDasharray}
                markerEnd={
                  edge.type === 'contains'
                    ? 'url(#arrow-contains)'
                    : edge.type === 'part_of'
                    ? 'url(#arrow-part_of)'
                    : edge.type === 'fits' || edge.type === 'fits_into'
                    ? 'url(#arrow-fits)'
                    : edge.type === 'incompatible_with'
                    ? 'url(#arrow-incompatible)'
                    : 'url(#arrow-cross)'
                }
              />

              {/* Edge Relation Text Label (Guarantees color is never the only signal) */}
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x={-edge.type.length * 3.8 - 8}
                  y={-9}
                  width={edge.type.length * 7.6 + 16}
                  height={18}
                  rx={4}
                  fill="#020617"
                  stroke={isSelected ? '#38bdf8' : edgeStyle.stroke}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                  fontSize={9.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {edge.type}
                </text>
              </g>
            </g>
          );
        })}

        {/* 2. NODES */}
        {Array.from(layout.nodes.values()).map((node) => {
          if (!node.visible) return null;
          const pos = getNodePosition(node);
          const isSelected = selectedNodeId === node.id;
          const isDimmed = Boolean(
            connectedContext && !connectedContext.nodeIds.has(node.id)
          );
          const styling = getNodeStyling(node.type, isSelected, isDimmed);

          // Raw node data to get properties and evidence count
          const rawNode = rawNodes.find((n) => n.id === node.id);
          const evidenceCount = rawNode?.evidence?.length || 0;
          const propCount = Object.keys(rawNode?.properties || {}).length;

          const width = node.type === 'subsystem' ? 220 : 180;
          const height = node.type === 'subsystem' ? 64 : 54;

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x - width / 2}, ${pos.y - height / 2})`}
              className={`cursor-pointer transition-opacity duration-200 ${styling.opacity}`}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id, pos.x, pos.y)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node.id);
              }}
            >
              {/* Node Card Container (ForeignObject for Tailwind styling and accessibility) */}
              <foreignObject width={width} height={height} className="overflow-visible">
                <div
                  className={`w-full h-full p-2 flex flex-col justify-between shadow-md select-none transition-all duration-150 border ${styling.border} ${styling.shape}`}
                >
                  {/* Top row: Type indicator and Evidence Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${styling.badge}`}>
                      {node.type === 'unknown_requirement' ? 'UNKNOWN' : node.type}
                    </span>

                    <div className="flex items-center space-x-1">
                      {node.collapsed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapse(node.id);
                          }}
                          className="px-1 text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/40"
                          title="Degree > 40 auto-collapsed child branches"
                        >
                          collapsed
                        </button>
                      )}
                      {rawNode?.batch && (
                        <span
                          className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-bold"
                          title={`Batch: ${rawNode.batch}`}
                        >
                          P5
                        </span>
                      )}
                      {evidenceCount > 0 && (
                        <span
                          className="flex items-center space-x-0.5 text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/50"
                          title={`${evidenceCount} verified citations attached to this node`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>{evidenceCount}</span>
                        </span>
                      )}
                      {propCount > 0 && (
                        <span
                          className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
                          title={`${propCount} mechanical properties defined`}
                        >
                          {propCount}p
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle row: Node Label (Derived strictly from node.name) */}
                  <div className="truncate">
                    <div className={`text-xs truncate ${styling.text}`} title={node.name}>
                      {node.name}
                    </div>
                  </div>

                  {/* Bottom row: Node ID */}
                  <div className="text-[9px] font-mono text-slate-400 truncate">
                    {node.id}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* Accessible Legend at Bottom Right (Text labels + Shape cues for print and color-blindness) */}
      <div className="absolute bottom-4 right-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 p-3 rounded-lg shadow-xl text-xs space-y-2 max-w-sm">
        <div className="text-[11px] font-semibold text-slate-200 border-b border-slate-800 pb-1 font-mono flex items-center justify-between">
          <span>GRAPH ONTOLOGY & LEGEND</span>
          <span className="text-[10px] text-slate-400 font-normal">Text-Labeled (Accessible)</span>
        </div>

        {/* Node types with TEXT and distinct borders */}
        <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/40 border border-purple-400" />
            <span className="text-slate-300">Subsystem</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/30 border border-sky-400" />
            <span className="text-slate-300">Component</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-400 border-dashed" />
            <span className="text-slate-300">Standard [dashed]</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/30 border border-amber-400" />
            <span className="text-slate-300">Property [capsule]</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/30 border border-rose-400" />
            <span className="text-slate-300">Diagnostic</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-400 border-dotted" />
            <span className="text-slate-300">Unknown [dotted]</span>
          </div>
        </div>

        {/* Edge types */}
        <div className="border-t border-slate-800/80 pt-1.5 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-sky-400" />
            <span className="text-slate-300">contains (Layered)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-indigo-400" />
            <span className="text-slate-300">part_of (Layered)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-emerald-400" />
            <span className="text-slate-300">fits (Cross-link)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 border-b border-rose-400 border-dashed" />
            <span className="text-rose-300">incompatible [dashed]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
