/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphPayload, GraphNode, GraphEdge } from '../types/graph.ts';
import relationOntology from '../data/relation-ontology.json';
import { validateGraphPayload } from './graph-validator.ts';

export const SCHEMA_VERSION = '1.0.0';

/**
 * Exports in-memory graph to JSONL string with schema_version header
 */
export function exportToJsonl(payload: GraphPayload): string {
  const lines: string[] = [];

  // Header metadata line
  lines.push(
    JSON.stringify({
      record_type: 'header',
      schema_version: SCHEMA_VERSION,
      app: 'Hi5 Mechanical Knowledge Graph',
      exported_at: new Date().toISOString(),
      node_count: payload.nodes.length,
      edge_count: payload.edges.length,
    })
  );

  // Nodes
  for (const node of payload.nodes) {
    lines.push(
      JSON.stringify({
        record_type: 'node',
        schema_version: SCHEMA_VERSION,
        ...node,
      })
    );
  }

  // Edges
  for (const edge of payload.edges) {
    lines.push(
      JSON.stringify({
        record_type: 'edge',
        schema_version: SCHEMA_VERSION,
        ...edge,
      })
    );
  }

  return lines.join('\n');
}

/**
 * Escapes XML strings for GraphML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescapes XML strings from GraphML
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Exports in-memory graph to valid GraphML XML string
 */
export function exportToGraphml(payload: GraphPayload): string {
  const xml: string[] = [];

  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push(
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns ' +
      'http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">'
  );

  // Schema & attribute keys
  xml.push('  <!-- Graph Attributes -->');
  xml.push('  <key id="schema_version" for="graph" attr.name="schema_version" attr.type="string"/>');
  xml.push('  <key id="app" for="graph" attr.name="app" attr.type="string"/>');

  xml.push('  <!-- Node Attributes -->');
  xml.push('  <key id="d_name" for="node" attr.name="name" attr.type="string"/>');
  xml.push('  <key id="d_type" for="node" attr.name="type" attr.type="string"/>');
  xml.push('  <key id="d_subsystem" for="node" attr.name="subsystem" attr.type="string"/>');
  xml.push('  <key id="d_description" for="node" attr.name="description" attr.type="string"/>');
  xml.push('  <key id="d_status" for="node" attr.name="status" attr.type="string"/>');
  xml.push('  <key id="d_aliases" for="node" attr.name="aliases" attr.type="string"/>');
  xml.push('  <key id="d_properties" for="node" attr.name="properties" attr.type="string"/>');
  xml.push('  <key id="d_node_evidence" for="node" attr.name="evidence" attr.type="string"/>');
  xml.push('  <key id="d_node_chunk_ids" for="node" attr.name="chunk_ids" attr.type="string"/>');

  xml.push('  <!-- Edge Attributes -->');
  xml.push('  <key id="d_relation" for="edge" attr.name="relation" attr.type="string"/>');
  xml.push('  <key id="d_claim" for="edge" attr.name="claim" attr.type="string"/>');
  xml.push('  <key id="d_status" for="edge" attr.name="status" attr.type="string"/>');
  xml.push('  <key id="d_evidence_type" for="edge" attr.name="evidence_type" attr.type="string"/>');
  xml.push('  <key id="d_confidence" for="edge" attr.name="confidence" attr.type="double"/>');
  xml.push('  <key id="d_conditions" for="edge" attr.name="conditions" attr.type="string"/>');
  xml.push('  <key id="d_conflicts" for="edge" attr.name="conflicts" attr.type="string"/>');
  xml.push('  <key id="d_scope" for="edge" attr.name="scope" attr.type="string"/>');
  xml.push('  <key id="d_edge_evidence" for="edge" attr.name="evidence" attr.type="string"/>');
  xml.push('  <key id="d_edge_chunk_ids" for="edge" attr.name="chunk_ids" attr.type="string"/>');

  // Graph body
  xml.push(`  <graph id="Hi5_Mechanical_Knowledge_Graph" edgedefault="directed">`);
  xml.push(`    <data key="schema_version">${SCHEMA_VERSION}</data>`);
  xml.push(`    <data key="app">Hi5 Mechanical Knowledge Graph</data>`);

  for (const node of payload.nodes) {
    xml.push(`    <node id="${escapeXml(node.id)}">`);
    xml.push(`      <data key="d_name">${escapeXml(node.name)}</data>`);
    xml.push(`      <data key="d_type">${escapeXml(node.type)}</data>`);
    xml.push(`      <data key="d_subsystem">${escapeXml(node.subsystem || '')}</data>`);
    xml.push(`      <data key="d_description">${escapeXml(node.description || '')}</data>`);
    xml.push(`      <data key="d_status">${escapeXml(node.status || 'verified')}</data>`);
    xml.push(`      <data key="d_aliases">${escapeXml(JSON.stringify(node.aliases || []))}</data>`);
    if (node.properties && Object.keys(node.properties).length > 0) {
      xml.push(`      <data key="d_properties">${escapeXml(JSON.stringify(node.properties))}</data>`);
    } else {
      xml.push(`      <data key="d_properties">{}</data>`);
    }
    if (node.evidence && node.evidence.length > 0) {
      xml.push(`      <data key="d_node_evidence">${escapeXml(JSON.stringify(node.evidence))}</data>`);
      xml.push(`      <data key="d_node_chunk_ids">${escapeXml(node.evidence.map((c) => c.chunk_id).join(','))}</data>`);
    } else {
      xml.push(`      <data key="d_node_evidence">[]</data>`);
    }
    xml.push(`    </node>`);
  }

  for (const edge of payload.edges) {
    xml.push(
      `    <edge id="${escapeXml(edge.id || `${edge.src}_${edge.dst}`)}" source="${escapeXml(edge.src)}" target="${escapeXml(edge.dst)}">`
    );
    xml.push(`      <data key="d_relation">${escapeXml(edge.type)}</data>`);
    xml.push(`      <data key="d_claim">${escapeXml(edge.claim)}</data>`);
    xml.push(`      <data key="d_status">${escapeXml(edge.status)}</data>`);
    xml.push(`      <data key="d_evidence_type">${escapeXml(edge.evidence_type || 'service_manual')}</data>`);
    xml.push(`      <data key="d_confidence">${escapeXml(String(edge.confidence ?? 1.0))}</data>`);
    xml.push(`      <data key="d_conditions">${escapeXml(JSON.stringify(edge.conditions || []))}</data>`);
    xml.push(`      <data key="d_conflicts">${escapeXml(JSON.stringify(edge.conflicts || []))}</data>`);
    if (edge.scope) {
      xml.push(`      <data key="d_scope">${escapeXml(JSON.stringify(edge.scope))}</data>`);
    }
    if (edge.evidence && edge.evidence.length > 0) {
      xml.push(`      <data key="d_edge_evidence">${escapeXml(JSON.stringify(edge.evidence))}</data>`);
      xml.push(`      <data key="d_edge_chunk_ids">${escapeXml(edge.evidence.map((c) => c.chunk_id).join(','))}</data>`);
    } else {
      xml.push(`      <data key="d_edge_evidence">[]</data>`);
    }
    xml.push(`    </edge>`);
  }

  xml.push('  </graph>');
  xml.push('</graphml>');

  return xml.join('\n');
}

/**
 * Extracts data tag values from a snippet of GraphML
 */
function extractDataValue(xmlSnippet: string, key: string): string | null {
  const match = xmlSnippet.match(new RegExp(`<data\\s+key="${key}">([\\s\\S]*?)<\\/data>`));
  return match ? unescapeXml(match[1]) : null;
}

/**
 * Validates and imports a graph from JSON, JSONL, or GraphML format.
 * Strictly verifies schema and refuses unknown relation types.
 */
export function importGraph(
  rawText: string,
  chunkTextLookup: Record<string, string>
): { valid: boolean; payload?: GraphPayload; errors: string[] } {
  const errors: string[] = [];
  const allowedRelationTypes = new Set(
    Object.keys(relationOntology.relations || {})
  );

  let parsedNodes: GraphNode[] = [];
  let parsedEdges: GraphEdge[] = [];

  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, errors: ['Input is empty.'] };
  }

  // 1. GraphML XML Parser
  if (trimmed.includes('<graphml') || trimmed.startsWith('<?xml')) {
    try {
      // Extract nodes: <node id="..."> ... </node>
      const nodeRegex = /<node\s+id="([^"]+)">([\s\S]*?)<\/node>/g;
      let nodeMatch: RegExpExecArray | null;
      while ((nodeMatch = nodeRegex.exec(trimmed)) !== null) {
        const id = unescapeXml(nodeMatch[1]);
        const inner = nodeMatch[2];
        const name = extractDataValue(inner, 'd_name') || id;
        const type = (extractDataValue(inner, 'd_type') || 'component') as any;
        const subsystem = (extractDataValue(inner, 'd_subsystem') || undefined) as any;
        const description = extractDataValue(inner, 'd_description') || '';
        const status = (extractDataValue(inner, 'd_status') || 'verified') as any;

        let aliases: string[] = [];
        const aliasRaw = extractDataValue(inner, 'd_aliases');
        if (aliasRaw) {
          try {
            aliases = JSON.parse(aliasRaw);
          } catch {
            aliases = [];
          }
        }

        let properties: any = {};
        const propsRaw = extractDataValue(inner, 'd_properties');
        if (propsRaw) {
          try {
            properties = JSON.parse(propsRaw);
          } catch {
            properties = {};
          }
        }

        let evidence: any[] = [];
        const evRaw = extractDataValue(inner, 'd_node_evidence');
        if (evRaw) {
          try {
            evidence = JSON.parse(evRaw);
          } catch {
            evidence = [];
          }
        }

        parsedNodes.push({
          id,
          name,
          type,
          subsystem,
          aliases,
          description,
          status,
          properties,
          evidence,
        });
      }

      // Extract edges: <edge id="..." source="..." target="..."> ... </edge>
      const edgeRegex = /<edge\s+id="([^"]*)"\s+source="([^"]+)"\s+target="([^"]+)">([\s\S]*?)<\/edge>/g;
      let edgeMatch: RegExpExecArray | null;
      while ((edgeMatch = edgeRegex.exec(trimmed)) !== null) {
        const id = unescapeXml(edgeMatch[1]);
        const src = unescapeXml(edgeMatch[2]);
        const dst = unescapeXml(edgeMatch[3]);
        const inner = edgeMatch[4];

        const relType = extractDataValue(inner, 'd_relation') || 'fits';
        const claim = extractDataValue(inner, 'd_claim') || '';
        const status = (extractDataValue(inner, 'd_status') || 'verified') as any;
        const evidence_type = (extractDataValue(inner, 'd_evidence_type') || 'service_manual') as any;
        const confRaw = extractDataValue(inner, 'd_confidence');
        const confidence = confRaw ? parseFloat(confRaw) : 1.0;

        let conditions: string[] = [];
        const condRaw = extractDataValue(inner, 'd_conditions');
        if (condRaw) {
          try {
            conditions = JSON.parse(condRaw);
          } catch {
            conditions = [];
          }
        }

        let conflicts: string[] = [];
        const confsRaw = extractDataValue(inner, 'd_conflicts');
        if (confsRaw) {
          try {
            conflicts = JSON.parse(confsRaw);
          } catch {
            conflicts = [];
          }
        }

        let scope: any = undefined;
        const scopeRaw = extractDataValue(inner, 'd_scope');
        if (scopeRaw) {
          try {
            scope = JSON.parse(scopeRaw);
          } catch {
            scope = undefined;
          }
        }

        let evidence: any[] = [];
        const evRaw = extractDataValue(inner, 'd_edge_evidence');
        if (evRaw) {
          try {
            evidence = JSON.parse(evRaw);
          } catch {
            evidence = [];
          }
        }

        parsedEdges.push({
          id: id || `${src}_${dst}`,
          src,
          dst,
          type: relType as any,
          claim,
          status,
          evidence_type,
          confidence,
          conditions,
          conflicts,
          scope,
          evidence,
        });
      }
    } catch (e) {
      errors.push(`GraphML parsing error: ${(e as Error).message}`);
    }
  } else {
    // 2. Attempt standard JSON parse
    let isSingleJson = false;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        parsedNodes = parsed.nodes;
        parsedEdges = parsed.edges;
        isSingleJson = true;
      }
    } catch {
      isSingleJson = false;
    }

    // 3. Fallback to JSONL line-by-line parsing
    if (!isSingleJson) {
      const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
          const item = JSON.parse(line);
          if (item.record_type === 'header') {
            continue;
          } else if (item.record_type === 'node' || (!item.record_type && item.type && item.name)) {
            parsedNodes.push(item);
          } else if (item.record_type === 'edge' || (!item.record_type && item.src && item.dst)) {
            parsedEdges.push(item);
          }
        } catch (e) {
          errors.push(`Line ${i + 1} is not valid JSON: ${(e as Error).message}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  if (parsedNodes.length === 0) {
    return { valid: false, errors: ['No nodes found in import file.'] };
  }

  // Ontology check: refuse unknown relation types
  for (const edge of parsedEdges) {
    if (!allowedRelationTypes.has(edge.type)) {
      errors.push(
        `Unknown relation type "${edge.type}" on edge "${edge.id || `${edge.src}->${edge.dst}`}". Allowed types: ${Array.from(allowedRelationTypes).join(', ')}`
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate payload through schema and quote validator
  const payloadCandidate: GraphPayload = {
    schema_version: SCHEMA_VERSION,
    nodes: parsedNodes,
    edges: parsedEdges,
  };

  const validation = validateGraphPayload(payloadCandidate, chunkTextLookup);
  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors,
    };
  }

  return { valid: true, payload: payloadCandidate, errors: [] };
}
