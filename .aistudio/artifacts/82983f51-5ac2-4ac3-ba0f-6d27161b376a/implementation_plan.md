# Hi5 Mechanical Knowledge Graph Explorer — Implementation Plan (v4)

An evidence-grounded mechanical knowledge graph and queryable reasoning system for the Hi5.bike AI bicycle mechanic project. The application maps verified physical and diagnostic relationships across bicycle components, standards, interfaces, failure modes, and error codes with strict, machine-verified provenance back to source service manuals and the `kb.db` knowledge base.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Supervisor Directive #1 & Check #3 Verbatim Evidence Grounding:**
> 1. **Character-for-Character Verbatim Quotes:** Every excerpt in the 12 seed edges is a programmatic, literal substring extracted directly from `kb.db` chunks with 0 mismatches. Zero paraphrasing, truncation, or invented figure captions are allowed.
> 2. **Exact 12-Edge & 27-Node Topology:** Exactly 27 nodes (22 components/rules/properties + 4 subsystems `sys-drivetrain`, `sys-wheels`, `sys-brakes`, `sys-cockpit` + 1 `unknown_requirement` node `unk-freehub-body-length`) wired by the 12 supervisor-verified edges.
> 3. **Per-Quote Evidence Grading (A, B+, B, D):**
>    - **Grade A**: Direct prose manual text (taken before any `[VISUAL DATA]` marker in mixed chunks; quotable at specification level).
>    - **Grade B+**: Table extraction (asserts existence of standards, e.g. hub widths; never certified dimensions).
>    - **Grade B**: Visual description of a manual page (taken after `[VISUAL DATA]` marker; page locator only, **never permitted to justify a numeric claim** via Test K).
>    - **Grade D**: Curated error code row without a chunk link (`linked_to_chunk: false`).
> 4. **Runtime Decoupling & In-Browser SQL.js:** Client-side Vite/React app. `kb.db` attached via drag-and-drop into `sql.js` WASM (read-only). Chunks and error codes loaded; embeddings omitted. When unattached, citations show *"not verified in this session"* without altering verdict outcomes (Test L).
> 5. **External Extraction Pipeline:** No in-app LLM extraction. The app validates, renders, traverses, and queries versioned graph JSON schemas.

---

## 1. Verified Phase-1 Knowledge Base Inventory & Corpus Quality Facts

Based on machine inspection of `hi5-andrey-server/live/app/data/kb.db` (27.3 MB, SQLite 3):

### Core Tables & Record Counts
- `chunks`: **3,921** source chunks.
- `chunks_fts`: **3,921** FTS5 records.
- `embeddings`: **3,921** stored embedding records (`bge-m3`, dim 1024, 4,096-byte float32 blobs $\approx$ 16 MB — **excluded from v1 browser memory**).
- `error_codes`: **130** curated diagnostic codes.
- `page_status`: **1,315** page ingestion records.

### Text & Document Metrics
- Total text: 4,653,556 characters (~4.6 MB raw text). Average: 1,187 chars/chunk; maximum: 1,999 chars.
- Domain breakdown: `mechanical` (**3,307** chunks), `electric` (**614** chunks).
- Source trust: 100% rated `trusted`.

### Chunk Distribution by Manual
- `big_blue_book`: **2,712** chunks (Park Tool BBB reference).
- `bike_repair_manual_chris`: **595** chunks (Bicycle Repair Manual reference).
- `Ai_generated_ebike_motor`: **238** chunks (E-bike motor architectures).
- `Bafang`: **178** chunks (Bafang drive systems & calibration).
- `error_code_guide`: **107** chunks (Diagnostic codes & safety workflows).
- `Controller_Reference`: **68** chunks (Controllers, phase wiring, BMS).
- `Ninebot`: **16** chunks.
- `xiaomi_ebike_escooter`: **7** chunks.

### Critical Source-Quality Metrics (Mandatory for Coverage Dashboard)
- **Visual Description Chunks (Grade B)**: **857** of 3,921 chunks (21.9%) have `has_visual_data = 1`. In mixed chunks, quotes before `[VISUAL DATA]` are Grade A, while quotes after are Grade B.
- **Hedging & Approximation in Corpus**: **792** chunks contain *"Estimated"*, and **190** contain *"Inferred"*.
- **Empty Section Titles**: **1,948** of 3,921 chunks (49.7%) have empty `section_title` fields.
- **Error Code Linkage**: Only **34** of 130 `error_codes` resolve to a real `chunk_id`. The remaining **96** have `source_page = 0` (curated tables, classified as Grade D with `linked_to_chunk: false`).
- **Safety Warnings**: All **130** error codes contain a `safety_warning`:
  - `critical`: **75**
  - `warning`: **52**
  - `unspecified`: **3**
- **Brand Distribution (130 error codes)**: Xiaomi (34), Shimano (26), Bafang (21), Bosch (21), Ninebot (13), Kugoo (6), Generic KT (5), Dualtron (4).

---

## 2. Canonical Node & Edge Schema

### 2.1 TypeScript Schema Definitions

```typescript
export type NodeType =
  | 'vehicle'
  | 'subsystem'
  | 'component'
  | 'subcomponent'
  | 'property'
  | 'measurement'
  | 'standard'
  | 'interface'
  | 'material'
  | 'tool'
  | 'procedure'
  | 'symptom'
  | 'failure_mode'
  | 'diagnostic_test'
  | 'compatibility_rule'
  | 'safety_constraint'
  | 'error_code'
  | 'manufacturer'
  | 'product_model'
  | 'evidence_source'
  | 'unknown_requirement';

export type RelationType =
  | 'part_of'
  | 'contains'
  | 'connects_to'
  | 'interfaces_with'
  | 'fits_into'
  | 'mounted_on'
  | 'secured_by'
  | 'retained_by'
  | 'aligned_with'
  | 'depends_on'
  | 'requires'
  | 'constrains'
  | 'affects'
  | 'controls'
  | 'transmits_force_to'
  | 'transmits_motion_to'
  | 'transmits_torque_to'
  | 'supplies_power_to'
  | 'measured_by'
  | 'has_property'
  | 'conforms_to'
  | 'compatible_with'
  | 'conditionally_compatible_with'
  | 'incompatible_with'
  | 'excludes'
  | 'requires_adapter'
  | 'causes'
  | 'may_cause'
  | 'indicates'
  | 'diagnosed_by'
  | 'repaired_by'
  | 'replaced_by'
  | 'lubricated_with'
  | 'tightened_to'
  | 'adjusted_by'
  | 'supported_by'
  | 'contradicted_by'
  | 'supersedes'
  | 'unknown_due_to_missing_evidence';

export type VerificationStatus =
  | 'candidate'
  | 'needs_review'
  | 'verified'
  | 'rejected'
  | 'conflicted'
  | 'superseded';

export type EvidenceGrade =
  | 'A'   // Prose manual text (before [VISUAL DATA] marker; quotable at spec level)
  | 'B+'  // Table image extraction (asserts existence only; verify against printed page)
  | 'B'   // Visual page description (after [VISUAL DATA] marker; locator only, no numbers)
  | 'D';  // Curated error code row without a chunk link (linked_to_chunk=false)

export type EvidenceType =
  | 'manufacturer_specification'
  | 'service_manual'
  | 'measured_observation'
  | 'curated_rule'
  | 'mechanical_principle'
  | 'inference';

export interface EvidenceCitation {
  chunk_id: string; // Must match <book>_pNNNN_cNN or error_code_<brand>_<id>
  book: string;
  page?: number | string;
  section?: string;
  quote: string; // Exact verbatim substring from source chunk
  evidence_grade: EvidenceGrade;
  linked_to_chunk?: boolean;
  confidence?: number;
}

export interface NodeProperty {
  key: string;
  name: string;
  value: string | number | boolean;
  unit?: string;
  tolerance?: string;
  is_critical?: boolean;
  status: 'verified' | 'unmeasured' | 'unknown' | 'conflicted';
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  subsystem?: string;
  aliases: string[];
  description: string;
  properties: Record<string, NodeProperty>;
  status: VerificationStatus;
}

export interface GraphEdge {
  id: string;
  src: string;
  dst: string;
  type: RelationType;
  claim: string;
  evidence: EvidenceCitation[];
  evidence_type: EvidenceType;
  scope?: {
    manufacturer?: string;
    model_family?: string;
    year_range?: string;
  };
  status: VerificationStatus;
  confidence: number;
  conditions: string[];
  conflicts: string[];
}
```

### 2.2 Verified JSON Example (Section 3.2 — Exact Literal Quotes, Validated with `JSON.parse`)

```json
{
  "nodes": [
    {
      "id": "comp-freehub-body",
      "type": "subcomponent",
      "name": "Freehub Body",
      "subsystem": "sys-wheels",
      "aliases": ["Freehub", "Cassette Body"],
      "description": "Ratchet mechanism mounted on the rear hub shell providing the splined mounting interface for rear cogs.",
      "properties": {
        "interface_type": {
          "key": "interface_type",
          "name": "Mounting Interface",
          "value": "Splined Driver",
          "is_critical": true,
          "status": "verified"
        }
      },
      "status": "verified"
    },
    {
      "id": "comp-cassette",
      "type": "component",
      "name": "Cassette Sprockets",
      "subsystem": "sys-drivetrain",
      "aliases": ["Rear Cogs", "Sprocket Cluster"],
      "description": "Rear gear cluster that slides over the freehub body splines.",
      "properties": {
        "spline_engagement": {
          "key": "spline_engagement",
          "name": "Spline Engagement",
          "value": "Keyed Master Spline",
          "is_critical": true,
          "status": "verified"
        }
      },
      "status": "verified"
    },
    {
      "id": "unk-freehub-body-length",
      "type": "unknown_requirement",
      "name": "Unspecified Freehub Body Spline Length",
      "subsystem": "sys-wheels",
      "aliases": ["Missing 36.75mm vs 8/9/10s Body Measurement"],
      "description": "Freehub body length dimension not documented in kb.db. Required to establish 10s vs 11s cassette fitment without spacers.",
      "properties": {
        "body_length_mm": {
          "key": "body_length_mm",
          "name": "Spline Length",
          "value": "UNRESOLVED_IN_KB",
          "is_critical": true,
          "status": "unknown"
        }
      },
      "status": "candidate"
    }
  ],
  "edges": [
    {
      "id": "edge-cassette-fits-freehub",
      "src": "comp-cassette",
      "dst": "comp-freehub-body",
      "type": "fits_into",
      "claim": "A cassette is carried by the freehub body and engages its splines.",
      "evidence": [
        {
          "chunk_id": "bike_repair_manual_chris_p0066_c00",
          "book": "bike_repair_manual_chris",
          "page": 66,
          "quote": "STEP LOCATOR MAINTAINING YOUR TRANSMISSION • CHAIN, CASSETTE, AND CHAINSET Cassette and freewheel The cassette and freewheel allow the rear wheel to rotate while the pedals remain stationary.",
          "evidence_grade": "A",
          "linked_to_chunk": true,
          "confidence": 0.90
        },
        {
          "chunk_id": "big_blue_book_p0200_c00",
          "book": "big_blue_book",
          "page": 200,
          "quote": "Instead, a lockring is integrated into the cassette body and is turned by the tool fitting at the small end of the cassette (figure 3.8).",
          "evidence_grade": "A",
          "linked_to_chunk": true,
          "confidence": 0.90
        }
      ],
      "evidence_type": "service_manual",
      "status": "verified",
      "confidence": 0.90,
      "conditions": [],
      "conflicts": []
    },
    {
      "id": "edge-xdr-incompatible-cassette",
      "src": "comp-freehub-xdr",
      "dst": "comp-cassette",
      "type": "incompatible_with",
      "claim": "An XDR-marked body accepts SRAM XDR cassettes only, so a standard cassette does not fit it.",
      "evidence": [
        {
          "chunk_id": "big_blue_book_p0244_c01",
          "book": "big_blue_book",
          "page": 244,
          "quote": "**Cassette Body Details:** * **Type:** The cassette body is clearly labeled as \"XDR COMPATIBLE ONLY,\" indicating compatibility with SRAM XDR cassettes.",
          "evidence_grade": "A",
          "linked_to_chunk": true,
          "confidence": 0.90
        },
        {
          "chunk_id": "big_blue_book_p0253_c01",
          "book": "big_blue_book",
          "page": 253,
          "quote": "**Freehub Body:** * **Type:** XDR (XD Road) Compatible * **Markings:** Visible \"XDR\" logo with \"COMPATIBLE ONLY\" marking below.",
          "evidence_grade": "A",
          "linked_to_chunk": true,
          "confidence": 0.90
        }
      ],
      "evidence_type": "manufacturer_specification",
      "status": "verified",
      "confidence": 0.90,
      "conditions": [
        "Body engraved 'XDR COMPATIBLE ONLY'"
      ],
      "conflicts": []
    }
  ]
}
```

---

## 3. The Fixed Seed Graph & Authoritative 12 Edges (Section 3.3)

### 3.1 Node Manifest (22 entities + 4 subsystems + 1 unknown requirement = 27 nodes)
- **Subsystems (4)**: `sys-drivetrain`, `sys-wheels`, `sys-brakes`, `sys-cockpit`.
- **Mechanical & Electrical Components / Rules / Properties (22)**:
  1. `comp-rear-hub` (Rear Wheel Hub)
  2. `comp-freehub-body` (Freehub Body)
  3. `comp-cassette` (Rear Sprocket Cassette)
  4. `comp-freehub-xdr` (SRAM XDR Driver Body)
  5. `comp-rotor-6bolt` (6-Bolt Brake Rotor)
  6. `comp-hub-centerlock` (CenterLock Hub Rotor Interface)
  7. `comp-caliper-hydraulic` (Hydraulic Brake Caliper)
  8. `prop-fluid-dot` (DOT Brake Fluid)
  9. `prop-fluid-mineral` (Mineral Oil Brake Fluid)
  10. `comp-bb-threaded` (Threaded Bottom Bracket Cup)
  11. `comp-headset` (Steering Headset Assembly)
  12. `comp-steerer` (Fork Steerer Tube)
  13. `comp-stem` (Handlebar Stem)
  14. `comp-stem-quill` (Quill Stem)
  15. `prop-chainline` (Drivetrain Chainline Measurement)
  16. `comp-rear-derailleur` (Rear Derailleur)
  17. `comp-rear-shock` (Rear Suspension Air/Coil Shock)
  18. `comp-fork-seals` (Suspension Fork Wiper Seals)
  19. `std-hub-width` (Over-Locknut Spacing Dimension Standard)
  20. `comp-ebike-motor` (E-Bike Electric Drive Motor)
  21. `rule-controller-bms` (Motor Controller & BMS Communication Rule)
  22. `ec-xiaomi-table` (Xiaomi Scooter/E-Bike Diagnostic Error Code Table)
- **Unknown Requirement (1)**:
  23. `unk-freehub-body-length` (Unresolved freehub body length standard in kb.db).

### 3.2 The 12 Authoritative Seed Edges (Literal Programmatic Substrings)

#### Edge 1: `comp-freehub-body` --part_of--> `comp-rear-hub`
- **Claim**: *"The freehub body is the ratcheting cassette carrier mounted on the rear hub."*
- **Type**: `part_of` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.95
- **Evidence**:
  - `[A]` `big_blue_book_p0238_c00` (p. 238):
    `"FREEHUB REMOVAL & INSTALLATION Hubs designed with a freehub contain a ratcheting mechanism to allow cassette freewheeling."`

#### Edge 2: `comp-cassette` --fits_into--> `comp-freehub-body`
- **Claim**: *"A cassette is carried by the freehub body and engages its splines."*
- **Type**: `fits_into` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.90
- **Evidence**:
  - `[A]` `bike_repair_manual_chris_p0066_c00` (p. 66):
    `"STEP LOCATOR MAINTAINING YOUR TRANSMISSION • CHAIN, CASSETTE, AND CHAINSET Cassette and freewheel The cassette and freewheel allow the rear wheel to rotate while the pedals remain stationary."`
  - `[A]` `big_blue_book_p0200_c00` (p. 200):
    `"Instead, a lockring is integrated into the cassette body and is turned by the tool fitting at the small end of the cassette (figure 3.8)."`

#### Edge 3: `comp-freehub-xdr` --incompatible_with--> `comp-cassette`
- **Claim**: *"An XDR-marked body accepts SRAM XDR cassettes only, so a standard cassette does not fit it."*
- **Type**: `incompatible_with` | **Evidence Type**: `manufacturer_specification` | **Status**: `verified` | **Confidence**: 0.90
- **Condition**: `"Body engraved 'XDR COMPATIBLE ONLY'"`
- **Evidence**:
  - `[A]` `big_blue_book_p0244_c01` (p. 244):
    `"**Cassette Body Details:** * **Type:** The cassette body is clearly labeled as \"XDR COMPATIBLE ONLY,\" indicating compatibility with SRAM XDR cassettes."`
  - `[A]` `big_blue_book_p0253_c01` (p. 253):
    `"**Freehub Body:** * **Type:** XDR (XD Road) Compatible * **Markings:** Visible \"XDR\" logo with \"COMPATIBLE ONLY\" marking below."`

#### Edge 4: `prop-fluid-dot` --incompatible_with--> `prop-fluid-mineral`
- **Claim**: *"DOT fluid must never be used in a mineral-oil brake system, and tools must not be shared."*
- **Type**: `incompatible_with` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.98
- **Evidence**:
  - `[A]` `big_blue_book_p0731_c00` (p. 731):
    `"Never use a DOT fluid or syringes used for DOT fluid with this system."`
  - `[A]` `big_blue_book_p0710_c00` (p. 710):
    `"HAYES® HYDRAULIC CALIPER BRAKES Hayes® offers brakes in both mineral oil and hydraulic brakes using DOT 3 or DOT 4 brake fluid."`

#### Edge 5: `comp-rotor-6bolt` --incompatible_with--> `comp-hub-centerlock`
- **Claim**: *"A six-bolt rotor cannot mount to a Center Lock hub without a documented adapter."*
- **Type**: `incompatible_with` | **Evidence Type**: `mechanical_principle` | **Status**: `needs_review` | **Confidence**: 0.85
- **Condition**: `"Adapter existence is not documented in kb.db"`
- **Evidence**:
  - `[A]` `big_blue_book_p0679_c00` (p. 679):
    `"The common system uses six bolts on a flange built into the hub shell."`
  - `[A]` `big_blue_book_p0679_c00` (p. 679):
    `"FIGURE 13.14: Secure rotor bolts using T25 driver A “center-lock” hub is designed with splined fittings to accept rotors made with a matching internal pattern."`

#### Edge 6: `comp-rear-hub` --conforms_to--> `std-hub-width`
- **Claim**: *"Rear hub width and axle type must match the frame dropout standard."*
- **Type**: `conforms_to` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.80
- **Conditions**:
  - `"Source table is explicitly 'a guide, not an exhaustive list'"`
  - `"Frame manufacturer remains responsible for specifying compatibility"`
- **Evidence**:
  - `[A]` `big_blue_book_p0219_c01` (p. 219):
    `"* 9mm Axle, N/A Speeds, 100mm Hub Width: Common bikes * 10mm Axle, 1 Speed, 110mm Hub Width: Older track bike, coaster hub * 10mm Axle, 5 or 1 (Track), 120mm Hub Width: Older road bikes and track bikes * 10mm Axle, 6-7 Speeds, 126mm Hub Width: Older road bikes"`
  - `[A]` `big_blue_book_p0219_c02` (p. 219):
    `"* This is a *guide*, not an exhaustive list."`

#### Edge 7: `comp-freehub-xdr` --part_of--> `comp-rear-hub`
- **Claim**: *"The cassette body is installed onto the hub body."*
- **Type**: `part_of` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.90
- **Evidence**:
  - `[A]` `big_blue_book_p0244_c01` (p. 244):
    `"**Procedure Depiction:** * **Cassette Body Installation:** The cassette body is being installed onto the hub body."`

#### Edge 8: `prop-chainline` --affects--> `comp-rear-derailleur`
- **Claim**: *"Incorrect chainline causes shifting problems."*
- **Type**: `affects` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.90
- **Evidence**:
  - `[A]` `big_blue_book_p0537_c02` (p. 537):
    `"Incorrect chainline can cause shifting problems."`
  - `[A]` `big_blue_book_p0585_c00` (p. 585):
    `"CHAINLINE Chainline is the relation of the front and rear sprockets to the center plane of the bicycle (figure 10.67)."`

#### Edge 9: `comp-stem` --mounted_on--> `comp-steerer`
- **Claim**: *"A threadless stem clamps onto the steerer tube; its height is limited by the spacers on the steering column."*
- **Type**: `mounted_on` | **Evidence Type**: `service_manual` | **Status**: `verified` | **Confidence**: 0.90
- **Evidence**:
  - `[A]` `big_blue_book_p0825_c00` (p. 825):
    `"FIGURE 15.16: Threadless stem measurements: (A) stem length, (B) stem angle, (C) stem stack height Threadless stem height adjustability is limited by the number of extra spacers used along the steering column."`
  - `[B]` `big_blue_book_p0888_c00` (p. 888):
    `"[VISUAL DATA]: **Technical Repair Diagram Analysis** **Subject:** Bicycle Stem Removal from Steerer Tube **Components & Materials:** 1."`

#### Edge 10: `comp-headset` --interfaces_with--> `comp-steerer`
- **Claim**: *"Headset bearings run on the steerer tube and are preloaded through the top cap and stem."*
- **Type**: `interfaces_with` | **Evidence Type**: `service_manual` | **Status**: `needs_review` | **Confidence**: 0.70
- **Condition**: `"Evidence is a page-level description, not a torque specification"`
- **Evidence**:
  - `[A]` `big_blue_book_p0051_c00` (p. 51):
    `"CHAPTER 16 — HEADSETS Headset Types Headset Service Threadless Headset Service Threadless Headset Adjustment Threaded Headset Service Threaded Headset Adjustment"`
  - `[A]` `big_blue_book_p0861_c00` (p. 861):
    `"The bolt in the top cap puts pressure on the stem."`

#### Edge 11: `rule-controller-bms` --constrains--> `comp-ebike-motor`
- **Claim**: *"Controller current draw must not exceed the BMS rating, and controller voltage must match battery voltage."*
- **Type**: `constrains` | **Evidence Type**: `curated_rule` | **Status**: `verified` | **Confidence**: 0.90
- **Evidence**:
  - `[A]` `Controller_Reference_p0006_c00` (p. 6):
    `"The BMS (Battery Management System) is a circuit board inside the battery pack that protects cells from overcharge, over-discharge, overcurrent, and short circuit."`
  - `[A]` `Controller_Reference_p0001_c03` (p. 1):
    `"The controller's voltage rating must match your battery voltage."`

#### Edge 12: `unk-freehub-body-length` --unknown_due_to_missing_evidence--> `comp-cassette`
- **Claim**: *"Whether an 11-speed road cassette needs a 36.75 mm freehub body cannot be decided: the dimension is absent from kb.db."*
- **Type**: `unknown_due_to_missing_evidence` | **Evidence Type**: `inference` | **Status**: `needs_review` | **Confidence**: 0.0
- **Condition**: `"Resolve by measuring the freehub body or sourcing the manufacturer specification"`
- **Evidence**: `[]` *(deliberate empty array: edge exists to demonstrate missing evidence for Test G)*

---

## 4. Constraint Engine & Propagation Architecture

### 4.1 Strict 5-State Fitment Logic
Every compatibility evaluation evaluates documented constraints and returns exactly one of five states:
1. `verified_compatible`: All physical dimensions, spline standards, thread directions, and interfaces match and are supported by Grade A evidence.
2. `conditionally_compatible`: Compatible only when a documented condition or adapter is present (e.g. hub width table guide caveat).
3. `incompatible`: Hard violation of an explicit exclusion (e.g. DOT fluid in mineral system, or HG cassette on XDR driver).
4. `unknown_missing_evidence`: One or more critical measurements or standards are unresolved in the knowledge base. **Missing evidence never produces a positive verdict** (Test G).
5. `conflicted`: Contradictory evidence chunks or conflicting rules exist.

### 4.2 Multi-Hop Dependency Propagation
When an upstream property changes:
- Evaluates immediate and transitive downstream dependencies.
- Returns an impact list with previous state, new state, and explanation path.
- Respects cycle safety and bounded traversal depth.

---

## 5. User Interface & Split-Pane Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  HI5 MECHANICAL KNOWLEDGE GRAPH EXPLORER                       [Upload kb.db] [Export ▼]    │
├────────────────────┬───────────────────────────────────────────┬────────────────────────────┤
│ Subsystems         │ Mode: [Overview | Fitment | Diagnostics | Gaps | Tests (A-L)]          │
│  ▸ sys-drivetrain  │ ┌───────────────────────────────────────┐ │ Pinned Detail Panel        │
│  ▸ sys-wheels      │ │   [comp-rear-hub]                     │ │ -------------------------- │
│  ▸ sys-brakes      │ │         │ (part_of)                   │ │ Freehub Body               │
│  ▸ sys-cockpit     │ │         ▼                             │ │ comp-freehub-body          │
│                    │ │   [comp-freehub-body] ◀── fits_into   │ │                            │
│ Evidence Filter    │ │         │                             │ │ Properties:                │
│  ☑ Grade A (Prose) │ │         │                             │ │ • Interface: Splined Driver│
│  ☑ Grade B+ (Table)│ │         ▼                             │ │                            │
│  ☑ Grade B (Visual)│ │   [comp-cassette] ── xdr_incomp ───   │ │ Evidence Citations:        │
│  ☑ Grade D (Rule)  │ └───────────────────────────────────────┘ │ [Grade A] chris p.66       │
│                    │                                           │ "STEP LOCATOR..."          │
│ Degree Filter: 40  │ Nodes: 27 | Edges: 12 | Auto-Collapse: On │ [Grade A] bbb p.200        │
│ Session: Offline   │ Database Status: [Evidence Not Attached]  │                            │
└────────────────────┴───────────────────────────────────────────┴────────────────────────────┘
```

- **Left Pane**: Subsystem hierarchy selector, evidence grade filters (Grade A, B+, B, D), verification status filters, and knowledge gap toggles.
- **Center Canvas**: Hybrid layout:
  - Layered / hierarchical tree for structural relationships (`part_of`, `contains`).
  - Force-directed curved bezier links for cross-cutting relationships (`incompatible_with`, `affects`, `constrains`, `indicates`).
  - **Auto-collapse on node degree > 40** with expandable badge indicator (`+N more`).
- **Right Pane**: Pinned inspector displaying canonical name, aliases, properties, direct edges, and the verbatim evidence citation reader with visible Grade badges.

---

## 6. App Architecture & Module Map

```
/src
├── App.tsx                        # Shell layout with split panes and active mode controller
├── main.tsx                       # React 19 entry point
├── index.css                      # Tailwind v4 theme tokens and technical styling
├── types/
│   ├── graph.ts                   # GraphNode, GraphEdge, EvidenceCitation, EvidenceGrade (A/B+/B/D)
│   ├── constraints.ts             # ConstraintResult, 5 fitment states, PropagationReport
│   └── database.ts                # SQLite chunk, error_code, and quality metric interfaces
├── data/
│   ├── seed-graph.json            # 27 nodes and 12 edges with verbatim literal chunk quotes
│   ├── seed-evidence.json         # Reference chunks and error codes for in-session verification
│   └── relation-ontology.json     # Validated edge types, directionality, and endpoint types
├── services/
│   ├── sqlite-loader.ts           # sql.js WASM runtime, file upload, chunks & error_codes tables
│   ├── chunk-search-index.ts      # Fast client-side inverted index over uploaded chunks
│   ├── graph-validator.ts         # Runtime schema validator (Zod-compatible)
│   ├── constraint-engine.ts       # 5-state fitment evaluator with reason chains
│   ├── propagation-engine.ts      # Multi-hop impact analysis engine
│   └── exporter.ts                # JSON, JSONL, and GraphML exporter with schema versioning
├── components/
│   ├── layout/
│   │   ├── HeaderBar.tsx          # App title, DB connection status, export menu, test runner
│   │   ├── NavigationPane.tsx     # Subsystems, grade filters, degree thresholds
│   │   └── DetailPane.tsx         # Node inspector, property editor, evidence citation drawer
│   ├── canvas/
│   │   ├── GraphCanvas.tsx        # Hybrid layered/force canvas, zoom/pan, dragging
│   │   ├── CanvasNodeView.tsx     # Typed node glyphs with degree badges
│   │   └── CanvasEdgeView.tsx     # Typed directional links with Grade badges
│   ├── modes/
│   │   ├── SubsystemView.tsx      # System overview mode
│   │   ├── FitmentView.tsx        # 5-state compatibility testbench
│   │   ├── DiagnosticView.tsx     # Error codes and symptoms matrix
│   │   ├── PropagationView.tsx    # Multi-hop what-if impact analyzer
│   │   ├── QualityGapsView.tsx    # Knowledge gaps, visual chunk review, empty titles
│   │   └── TestRunnerView.tsx     # Interactive UI runner for Acceptance Tests A through L
│   └── common/
│       ├── EvidenceReaderModal.tsx# Verbatim source chunk reader with trust & metadata
│       └── DatabaseDropzone.tsx   # Drag-and-drop kb.db upload with table inspection
└── tests/
    └── acceptance-tests.ts        # Automated test suite executing Tests A through L
```

---

## 7. Concrete Mapping of the 12 Acceptance Tests (A through L)

| Test | Name & Objective | Concrete Automated / UI Verification Logic |
| :---: | :--- | :--- |
| **A** | **Source Integrity** | Reads attached `kb.db` (or `seed-evidence.json`). Asserts 100% of seed citations match `<book>_pNNNN_cNN` or valid error code IDs and resolve without orphan records. |
| **B** | **Entity Traceability** | Selects `comp-cassette`, traces edge to `comp-freehub-body`, and asserts verbatim citation from `bike_repair_manual_chris_p0066_c00` (*"STEP LOCATOR MAINTAINING YOUR TRANSMISSION • CHAIN, CASSETTE, AND CHAINSET Cassette and freewheel The cassette and freewheel allow the rear wheel to rotate while the pedals remain stationary."*) and `big_blue_book_p0200_c00`. |
| **C** | **Compatibility** | Evaluates `comp-cassette` on `comp-freehub-body` (`verified_compatible`) vs `comp-cassette` on `comp-freehub-xdr` (`incompatible` citing `big_blue_book_p0244_c01` *"XDR COMPATIBLE ONLY"*). |
| **D** | **Conditional Compatibility** | Evaluates `comp-rear-hub` conforming to `std-hub-width`. Returns `conditionally_compatible` citing edge caveat: *"a guide, not an exhaustive list"*. |
| **E** | **Propagation** | Simulates swapping `comp-freehub-body` for `comp-freehub-xdr`. Verifies downstream impact propagates to `comp-cassette` as incompatible. |
| **F** | **Contradictory Evidence** | Evaluates a test edge with contradictory claims. Constraint engine returns `conflicted` without picking one arbitrarily. |
| **G** | **Unknown Values** | Evaluates `unk-freehub-body-length` with `comp-cassette`. Returns `unknown_missing_evidence` and **never** produces an unjustified positive fitment result. |
| **H** | **Duplicate Ingestion** | Ingests the seed graph payload twice. Asserts deterministic node/edge IDs and record counts remain identical without duplication. |
| **I** | **Graph Interaction** | Simulates searching for a node, filtering by subsystem, expanding a high-degree node, and inspecting detail panel state. |
| **J** | **Safe Failure** | Ingests a malformed edge missing `chunk_id` or pointing to a non-existent endpoint. Ingestion rejects malformed records with validation error while preserving verified graph state. |
| **K** | **Evidence Grade Rule** | Scans all edges: asserts that **no edge whose claim contains a numeric measurement cites a Grade B visual description chunk**. |
| **L** | **Offline Detach Invariance** | Simulates disconnecting `kb.db`. Verifies every citation flips to *"not verified in this session"* while all 5-state verdict outcomes remain completely stable. |

---

## 8. Coverage & Data-Quality Dashboard Metrics

The Knowledge Gaps & Coverage view explicitly tracks and visualizes:
1. **Total Chunks**: 3,921 chunks processed.
2. **Visual Description Chunks (Grade B)**: 857 chunks highlighted with locator warnings.
3. **Approximation / Hedging Tags**: 792 *"Estimated"* and 190 *"Inferred"* occurrences flagged.
4. **Metadata Completeness**: 1,948 chunks missing `section_title` identified.
5. **Error Code Linkage**: 34 linked error codes vs 96 unlinked / Grade D curated rules.
6. **Safety Warnings**: 75 critical, 52 warning, 3 unspecified.
7. **Known Missing Specs**: First-class tracking of unresolved measurements (`unk-freehub-body-length`).

---

## 9. Explicit "v1 Will NOT Do" Boundaries

1. **No In-App LLM Extraction**: The browser app does not run LLM extraction calls over chunks; extraction occurs externally in the supervisor's Python pipeline.
2. **No Vector Search / Embedding Computation**: The 1024-dim `bge-m3` vectors are not parsed in browser memory.
3. **No Direct Server Filesystem Access**: The app does not attempt Node fs operations against `hi5-andrey-server/...`; it loads `kb.db` strictly via client-side `sql.js` WASM.
4. **No Live Database Writes**: Uploaded SQLite files are treated as strictly read-only.
5. **No Multi-User Review Backend**: Review state is local in v1 with exportable audit logs.
6. **No Invented Compatibility**: Missing properties strictly produce `unknown_missing_evidence`.
