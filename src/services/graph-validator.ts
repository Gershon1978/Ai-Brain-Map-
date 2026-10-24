/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import type { GraphNode, GraphPayload } from '../types/graph.ts';
import relationOntology from '../data/relation-ontology.json';

export const NodePropertySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  tolerance: z.string().optional(),
  is_critical: z.boolean().optional(),
  status: z.enum(['verified', 'unmeasured', 'unknown', 'conflicted', 'needs_review']),
  note: z.string().optional(),
});

export const EvidenceGradeSchema = z.enum(['A', 'B+', 'B', 'D']);

export const EvidenceCitationSchema = z.object({
  chunk_id: z.string().min(1),
  book: z.string().min(1),
  page: z.union([z.number(), z.string()]).optional(),
  section: z.string().optional(),
  quote: z.string(),
  evidence_grade: EvidenceGradeSchema,
  linked_to_chunk: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'vehicle',
    'subsystem',
    'component',
    'subcomponent',
    'property',
    'measurement',
    'standard',
    'interface',
    'material',
    'tool',
    'procedure',
    'symptom',
    'failure_mode',
    'diagnostic_test',
    'compatibility_rule',
    'safety_constraint',
    'error_code',
    'manufacturer',
    'product_model',
    'evidence_source',
    'unknown_requirement',
  ]),
  name: z.string().min(1),
  subsystem: z.string().optional(),
  aliases: z.array(z.string()),
  description: z.string(),
  properties: z.record(z.string(), NodePropertySchema),
  status: z.enum(['candidate', 'needs_review', 'verified', 'rejected', 'conflicted', 'superseded']),
  evidence: z.array(EvidenceCitationSchema).optional(),
});

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  dst: z.string().min(1),
  type: z.enum([
    'part_of',
    'contains',
    'connects_to',
    'interfaces_with',
    'fits_into',
    'mounted_on',
    'secured_by',
    'retained_by',
    'aligned_with',
    'depends_on',
    'requires',
    'constrains',
    'affects',
    'controls',
    'transmits_force_to',
    'transmits_motion_to',
    'transmits_torque_to',
    'supplies_power_to',
    'measured_by',
    'has_property',
    'conforms_to',
    'compatible_with',
    'conditionally_compatible_with',
    'incompatible_with',
    'excludes',
    'requires_adapter',
    'causes',
    'may_cause',
    'indicates',
    'diagnosed_by',
    'repaired_by',
    'replaced_by',
    'lubricated_with',
    'tightened_to',
    'adjusted_by',
    'supported_by',
    'contradicted_by',
    'supersedes',
    'unknown_due_to_missing_evidence',
  ]),
  claim: z.string().min(1),
  evidence: z.array(EvidenceCitationSchema),
  evidence_type: z.enum([
    'manufacturer_specification',
    'service_manual',
    'measured_observation',
    'curated_rule',
    'mechanical_principle',
    'inference',
  ]),
  scope: z
    .object({
      manufacturer: z.string().optional(),
      model_family: z.string().optional(),
      year_range: z.string().optional(),
    })
    .optional(),
  status: z.enum(['candidate', 'needs_review', 'verified', 'rejected', 'conflicted', 'superseded']),
  confidence: z.number().min(0).max(1),
  conditions: z.array(z.string()),
  conflicts: z.array(z.string()),
});

export const GraphPayloadSchema = z.object({
  schema_version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  provenance: z.any().optional(),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  verified_citations_count: number;
}

function matchesQuote(chunkText: string, quote: string): boolean {
  if (chunkText.includes(quote)) return true;
  const normText = chunkText.replace(/\s+/g, ' ');
  const normQuote = quote.replace(/\s+/g, ' ');
  return normText.includes(normQuote);
}

/**
 * Validates a complete graph payload including ontology constraints,
 * reference integrity, Test K (Grade B may not justify numeric claims),
 * and MANDATORY literal quote substring verification against real chunk text.
 */
export function validateGraphPayload(
  payload: unknown,
  chunkTextLookup?: Record<string, string>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let verifiedCitationsCount = 0;

  // Fix a: Mandatory quote check
  if (!chunkTextLookup || Object.keys(chunkTextLookup).length === 0) {
    errors.push(
      'Mandatory quote validation failed: chunkTextLookup must be supplied to verify evidence citations against corpus.'
    );
    return { valid: false, errors, warnings, verified_citations_count: 0 };
  }

  const parseResult = GraphPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`[Schema error at ${issue.path.join('.')}] ${issue.message}`);
    }
    return { valid: false, errors, warnings, verified_citations_count: 0 };
  }

  const { nodes, edges } = parseResult.data as GraphPayload;
  const nodeMap = new Map<string, GraphNode>();

  // Check unique node IDs & validate node citations
  for (const node of nodes) {
    if (nodeMap.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    } else {
      nodeMap.set(node.id, node);
    }

    if (node.evidence && Array.isArray(node.evidence)) {
      for (const cit of node.evidence) {
        // Fix b: linked_to_chunk is derived at runtime
        const isLinked = Boolean(chunkTextLookup[cit.chunk_id]);
        if (!isLinked) {
          if (node.status === 'verified') {
            errors.push(
              `Node ${node.id} has status 'verified' but citation ${cit.chunk_id} is not linked to an available chunk in kb.db.`
            );
          }
        } else {
          verifiedCitationsCount++;
          const text = chunkTextLookup[cit.chunk_id];
          if (!matchesQuote(text, cit.quote)) {
            errors.push(
              `Quote assertion failure on node ${node.id} citation ${cit.chunk_id}: quote is not a literal substring of chunk text!`
            );
          }
        }
      }
    }
  }

  // Check edges
  const edgeIdSet = new Set<string>();
  const relations = (relationOntology as any).relations || {};

  for (const edge of edges) {
    if (edgeIdSet.has(edge.id)) {
      errors.push(`Duplicate edge id: ${edge.id}`);
    }
    edgeIdSet.add(edge.id);

    const srcNode = nodeMap.get(edge.src);
    const dstNode = nodeMap.get(edge.dst);

    if (!srcNode) {
      errors.push(`Edge ${edge.id} references non-existent source node: ${edge.src}`);
    }
    if (!dstNode) {
      errors.push(`Edge ${edge.id} references non-existent target node: ${edge.dst}`);
    }

    // Ontology relationship rules
    const ontologyRule = relations[edge.type];
    if (!ontologyRule) {
      errors.push(`Edge ${edge.id} uses unregistered relationship type: ${edge.type}`);
    } else if (srcNode && dstNode) {
      if (
        ontologyRule.allowed_source_types &&
        !ontologyRule.allowed_source_types.includes(srcNode.type)
      ) {
        errors.push(
          `Edge ${edge.id} (${edge.type}) source ${srcNode.id} of type '${srcNode.type}' not in allowed types: [${ontologyRule.allowed_source_types.join(', ')}]`
        );
      }
      if (
        ontologyRule.allowed_target_types &&
        !ontologyRule.allowed_target_types.includes(dstNode.type)
      ) {
        errors.push(
          `Edge ${edge.id} (${edge.type}) target ${dstNode.id} of type '${dstNode.type}' not in allowed types: [${ontologyRule.allowed_target_types.join(', ')}]`
        );
      }
    }

    // Test K: No edge whose claim contains a numeric measurement may cite a Grade B quote
    const claimHasNumber = /\b\d+(\.\d+)?\s*(mm|t|nm|n·m|v|w|a|deg|°)\b/i.test(edge.claim);
    for (const cit of edge.evidence) {
      if (cit.evidence_grade === 'B' && claimHasNumber) {
        errors.push(
          `Test K violation: Edge ${edge.id} contains numeric claim ("${edge.claim}") but cites Grade B visual description chunk ${cit.chunk_id}`
        );
      }

      // Fix b: derived linked_to_chunk check
      const isLinked = Boolean(chunkTextLookup[cit.chunk_id]);
      if (!isLinked) {
        if (edge.status === 'verified') {
          errors.push(
            `Edge ${edge.id} has status 'verified' but citation ${cit.chunk_id} is not linked to chunk.`
          );
        }
      } else {
        verifiedCitationsCount++;
        const text = chunkTextLookup[cit.chunk_id];
        if (!matchesQuote(text, cit.quote)) {
          errors.push(
            `Quote assertion failure on edge ${edge.id} citation ${cit.chunk_id}: quote is not a literal substring of chunk text!`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    verified_citations_count: verifiedCitationsCount,
  };
}
