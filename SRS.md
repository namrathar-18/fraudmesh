# FraudMesh — Software Requirements Specification (SRS)
### One-Week MVP · IEEE-830-aligned

| Field | Value |
|---|---|
| **Product** | FraudMesh — Real-Time Payment Fraud Detection Platform |
| **Document** | Software Requirements Specification |
| **Version** | 1.0 (One-Week MVP) |
| **Author** | namrp.18@gmail.com |
| **Date** | 2026-07-05 |
| **Companion** | `FraudMesh_PRD.md` |
| **Status** | Draft — for build |

---

## Table of Contents
1. Introduction
2. Overall Description
3. External Interface Requirements
4. Functional Requirements
5. Non-Functional Requirements
6. Data Requirements
7. System Models
8. Constraints, Assumptions & Dependencies
9. Acceptance Criteria & Traceability
10. Glossary

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the functional and non-functional requirements for the **one-week MVP** of FraudMesh: a real-time payment fraud detection platform that scores transactions under a hard latency budget, detects fraud rings via graph intelligence, detects concept drift, and provides an AI copilot that explains decisions. It is the authoritative specification against which the MVP is built and accepted.

### 1.2 Scope
FraudMesh MVP is a **locally deployed** (Docker Compose) system comprising: a transaction simulator, a streaming bus, a low-latency scoring service, an online feature store, a graph analytics service, a drift/anomaly component, an AI copilot service, and an analyst dashboard. It ingests synthetic UPI-like payment events and produces block/allow/review decisions with stored explanations and a human feedback loop.

**In scope:** end-to-end scoring loop, feature store, graph ring detection, SHAP explainability, RAG copilot, drift demo, dashboard, latency/load proof.
**Out of scope (MVP):** Kubernetes/cloud deployment, automated MLflow champion/challenger promotion, GraphSAGE, production auth/RBAC, horizontal scaling. See PRD §2.2 and §9.

### 1.3 Definitions, Acronyms, Abbreviations
See §10 Glossary.

### 1.4 References
- IEEE Std 830-1998 (Recommended Practice for SRS).
- Companion `FraudMesh_PRD.md` (product goals, personas, build plan).

### 1.5 Overview
§2 gives context and constraints; §3 external interfaces; §4 the numbered functional requirements (FR); §5 non-functional requirements (NFR); §6 data; §7 models; §8 assumptions; §9 acceptance/traceability.

---

## 2. Overall Description

### 2.1 Product Perspective
FraudMesh is a self-contained, multi-service system. It is new (greenfield) and integrates only synthetic/simulated data sources. Services communicate over a streaming bus (Redpanda, Kafka-API compatible), HTTP (FastAPI), and WebSocket (dashboard). State lives in Redis (online features), Postgres (decisions, labels, SHAP, vectors), and an in-process/NetworkX graph.

### 2.2 Product Functions (summary)
- Generate realistic + fraudulent payment traffic.
- Maintain rolling online features with TTL.
- Score each transaction within a latency budget (two-tier: rules + LightGBM).
- Detect novel anomalies (Isolation Forest) and concept drift (PSI/KS).
- Build an account/device/transaction graph and detect rings (Louvain) + mule scores.
- Store per-decision SHAP explanations.
- Provide a grounded AI copilot explanation per case.
- Present a dashboard with live stream, ring graph, latency panel, case queue, and false-positive feedback.

### 2.3 User Classes & Characteristics
| Class | Description | Technical level |
|---|---|---|
| Fraud Analyst | Triages cases, reads explanations, flags FPs | Domain expert, non-developer |
| Platform/ML Engineer | Operates, tunes, defends the system | Expert |
| Evaluator/Interviewer | Observes the demo | Expert, read-only |

### 2.4 Operating Environment
- Single developer machine (Windows 11 host; services in Docker Linux containers).
- Runtime: Python 3.11+ (services), Node 18+/Vite + React (dashboard).
- Data stores: Redis 7+, PostgreSQL 15+ (with pgvector optional), Redpanda latest.

### 2.5 Design & Implementation Constraints
- **C1:** Hot-path scoring must not perform graph queries or unbounded I/O.
- **C2:** Feature computation code MUST be shared between training and serving (no train/serve skew).
- **C3:** All external LLM copilot output MUST be grounded in tool-returned facts.
- **C4:** MVP runs on a single node; no orchestration beyond Docker Compose.

### 2.6 Assumptions & Dependencies
See §8.

---

## 3. External Interface Requirements

### 3.1 User Interfaces
- **UI-1 Dashboard (web):** Live scored-transaction stream; case queue with detail drawer; force-directed ring graph; p50/p95/p99 latency panel; drift alert banner; "Mark False-Positive" control.
- Accessibility/polish beyond a clean functional layout is out of scope for MVP.

### 3.2 Software Interfaces
- **SI-1 Streaming:** Kafka wire protocol (Redpanda). Topic `transactions` (events), topic `decisions` (scored results), topic `graph-updates`.
- **SI-2 Scoring API:** `POST /score` (internal), returns decision + score + reasons.
- **SI-3 Copilot API:** `POST /explain/{decision_id}` → grounded narrative + cited facts.
- **SI-4 Feedback API:** `POST /label` (`decision_id`, `label`, `analyst_id`).
- **SI-5 Feature store:** Redis commands with TTL.
- **SI-6 Persistence:** Postgres SQL for decisions/labels/SHAP/vectors.

### 3.3 Communication Interfaces
- **CI-1:** WebSocket push from gateway to dashboard for live stream and alerts.
- **CI-2:** HTTP/JSON between services.

---

## 4. Functional Requirements

> Priority: **M** = Must (MVP), **S** = Should (if time), **C** = Could (stretch).

### 4.1 Transaction Simulation
- **FR-1 (M):** The simulator SHALL emit UPI-like transaction events with fields defined in §6.1 at a configurable target TPS.
- **FR-2 (M):** The simulator SHALL inject at least three fraud scenarios: account takeover, mule fan-in/fan-out network, laundering chain.
- **FR-3 (M):** Each event SHALL carry a unique idempotency key (`txn_id`).
- **FR-4 (M):** The simulator SHALL provide a "shift tactics" control that changes the statistical profile of fraud to induce concept drift on demand.

### 4.2 Ingestion & Streaming
- **FR-5 (M):** The system SHALL consume transaction events from the streaming bus.
- **FR-6 (M):** The consumer SHALL manage offsets and SHALL be idempotent on `txn_id` so a crash/restart does not double-score a transaction.

### 4.3 Online Feature Store
- **FR-7 (M):** The system SHALL maintain rolling per-entity features in Redis, including at minimum: transactions in last 5 minutes, distinct devices in last 24 hours, amount relative to the payer's historical median, and payee in-degree.
- **FR-8 (M):** Each rolling feature SHALL enforce an explicit TTL/window so stale data expires deterministically.
- **FR-9 (M):** Feature computation SHALL use a single shared code module invoked by both the training pipeline and the serving path (satisfies C2).

### 4.4 Scoring (Hot Path)
- **FR-10 (M):** The scoring service SHALL apply a cheap rules layer plus a LightGBM model using cached online features to produce a fraud score in [0,1].
- **FR-11 (M):** The service SHALL map the score to a decision: **allow / review / block** using configurable thresholds.
- **FR-12 (M):** The service SHALL NOT perform graph queries in the hot path (satisfies C1).
- **FR-13 (M):** The service SHALL enforce a per-request time budget and, on budget exceedance or model error, SHALL fall back to a rules-only decision (degraded mode) with a configurable default action.
- **FR-14 (M):** Every decision SHALL be persisted with its score, decision, feature snapshot, model version, and SHAP values.
- **FR-15 (M):** The service SHALL record per-request latency for p50/p95/p99 computation.

### 4.5 Graph Intelligence (Async)
- **FR-16 (M):** An asynchronous graph service SHALL maintain an account–device–transaction graph from the event stream.
- **FR-17 (M):** The graph service SHALL run Louvain community detection to assign ring IDs and SHALL compute a PageRank-style mule score per node.
- **FR-18 (M):** Ring membership and mule score SHALL be written back to the feature store to enrich the *next* transaction for that account.
- **FR-19 (M):** The graph service SHALL expose `get_ring_neighbors(account)` for the copilot and dashboard.

### 4.6 Anomaly & Drift Detection
- **FR-20 (M):** An Isolation Forest SHALL score transactions for novelty and flag anomalies not caught by the supervised model.
- **FR-21 (M):** The system SHALL compute PSI/KS statistics on selected feature distributions and SHALL raise a drift alert when a threshold is exceeded.
- **FR-22 (S):** On drift alert, the system SHALL support a (manual or simulated) retrain-and-compare step recording the challenger's offline metrics.

### 4.7 Explainability
- **FR-23 (M):** The system SHALL compute and store SHAP values for each scored transaction, including the top contributing features and their signed contributions.

### 4.8 AI Copilot (RAG + Tools)
- **FR-24 (M):** The copilot SHALL expose tools `get_account_history()`, `get_ring_neighbors()`, `similar_cases()`, and `get_shap_record()`.
- **FR-25 (M):** The copilot SHALL retrieve similar past cases and relevant fraud-pattern playbook content via vector search.
- **FR-26 (M):** The copilot SHALL produce a plain-language explanation for a decision grounded ONLY in tool-returned facts and SHALL NOT invent facts (satisfies C3).
- **FR-27 (M):** The explanation SHALL reference the concrete evidence used (e.g., SHAP contributions, ring proximity, similar case ID).

### 4.9 Feedback Loop
- **FR-28 (M):** An analyst SHALL be able to mark a decision as false-positive (or confirm fraud); the label SHALL be persisted with analyst and timestamp.
- **FR-29 (S):** Persisted labels SHALL be consumable by the training pipeline for retraining.

### 4.10 Dashboard
- **FR-30 (M):** The dashboard SHALL display a live stream of scored transactions with score, decision, and top reasons.
- **FR-31 (M):** The dashboard SHALL display a force-directed graph in which a detected ring visibly clusters/highlights (2D acceptable; **FR-31a (C):** 3D Three.js rendering).
- **FR-32 (M):** The dashboard SHALL display a p50/p95/p99 scoring-latency panel updating in near-real-time.
- **FR-33 (M):** The dashboard SHALL provide a case queue and a detail drawer showing the copilot explanation and the FP control.
- **FR-34 (M):** The dashboard SHALL show a drift-alert banner when FR-21 fires.

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **NFR-1:** Scoring latency SHALL be **p99 < 100 ms** under steady local load. *(Primary SLO.)*
- **NFR-2:** The system SHALL sustain **≥ 200 TPS** locally without breaching NFR-1; the achieved p50/p95/p99 and TPS SHALL be recorded in the README.
- **NFR-3:** Feature-store reads on the hot path SHALL be O(1)/O(log n) Redis operations.

### 5.2 Reliability & Availability
- **NFR-4:** A consumer crash SHALL NOT cause duplicate scoring (idempotency, FR-6).
- **NFR-5:** Model failure SHALL degrade gracefully to rules-only mode (FR-13), never blocking the pipeline.

### 5.3 Scalability (design intent only for MVP)
- **NFR-6:** Feature keys SHALL be entity-scoped so the store could be sharded by entity in future (design documented, not implemented).

### 5.4 Security & Privacy
- **NFR-7:** All data is synthetic; no real PII. Copilot prompts SHALL NOT exfiltrate secrets.
- **NFR-8:** Service-to-service calls are within the local Docker network; no public exposure in MVP.

### 5.5 Explainability & Compliance (talking point)
- **NFR-9:** Every automated decision SHALL have a stored, retrievable explanation (SHAP record), aligning with the regulatory expectation that fraud decisions be explainable.

### 5.6 Maintainability
- **NFR-10:** Feature logic SHALL exist in exactly one module (FR-9) to prevent train/serve skew.
- **NFR-11:** Each service SHALL be independently buildable and runnable via Docker Compose.

### 5.7 Observability
- **NFR-12:** The system SHALL expose scoring latency metrics and decision counts for the latency panel (and optionally Prometheus/Grafana as a stretch).

### 5.8 Usability
- **NFR-13:** An analyst SHALL be able to go from a blocked transaction to a readable explanation in ≤ 2 clicks.

---

## 6. Data Requirements

### 6.1 Transaction Event (input)
| Field | Type | Notes |
|---|---|---|
| `txn_id` | string (UUID) | idempotency key |
| `timestamp` | ISO-8601 / epoch ms | event time |
| `payer_vpa` | string | payer virtual payment address |
| `payee_vpa` | string | payee VPA |
| `amount` | decimal | INR |
| `device_id` | string | device fingerprint |
| `ip` | string | source IP |
| `channel` | enum | e.g., P2P, P2M |

### 6.2 Decision Record (Postgres)
`decision_id, txn_id, score, decision(allow|review|block), model_version, feature_snapshot(jsonb), shap(jsonb), anomaly_flag, ring_id, mule_score, degraded_mode(bool), created_at`.

### 6.3 Label Record (Postgres)
`label_id, decision_id, label(fraud|false_positive|confirmed), analyst_id, created_at`.

### 6.4 Case Vector Store
Embeddings of past cases + playbook snippets for RAG (pgvector or in-memory index for MVP).

### 6.5 Feature Store (Redis)
Entity-keyed rolling counters/aggregates with TTL windows (5 min, 24 h) per FR-7/FR-8.

---

## 7. System Models

### 7.1 Data Flow (textual)
1. Simulator → `transactions` topic.
2. Scoring consumer reads event → reads/updates Redis features → rules + LightGBM → decision → persist (Postgres) → publish `decisions` → WebSocket to dashboard.
3. Graph service consumes stream asynchronously → updates graph → Louvain + mule score → writes enrichment back to Redis.
4. Analyst reads case → copilot calls tools + vector search → grounded explanation → analyst marks label → persisted.
5. Drift monitor computes PSI/KS → raises alert on threshold breach.

### 7.2 State Stores
- Redis: online features (ephemeral, TTL).
- Postgres: decisions, labels, SHAP, vectors (durable).
- NetworkX/in-memory: graph (rebuildable from stream).

---

## 8. Constraints, Assumptions & Dependencies
- **A1:** All input data is synthetic; model metrics are reported "on synthetic data."
- **A2:** Single-node local deployment; performance numbers are laptop-class, not production.
- **A3:** LightGBM is chosen over deep nets specifically to meet the latency budget (tabular + fast inference + native SHAP).
- **A4:** Graph queries are excluded from the hot path by design; enrichment is next-transaction.
- **D1:** Depends on Redpanda, Redis, Postgres, LightGBM, SHAP, NetworkX, python-louvain, an LLM endpoint for the copilot, and Vite/React.

---

## 9. Acceptance Criteria & Traceability

### 9.1 Acceptance Criteria (must all pass for MVP sign-off)
| ID | Criterion | Verifies |
|---|---|---|
| AC-1 | Under steady load, measured p99 < 100 ms shown live and in README | NFR-1, FR-15, FR-32 |
| AC-2 | ≥ 200 TPS sustained with load-test output captured | NFR-2 |
| AC-3 | Fraud transactions blocked; PR-AUC reported on held-out set | FR-10, FR-11 |
| AC-4 | Same feature module used in train + serve (code inspection) | FR-9, NFR-10 |
| AC-5 | Injected mule ring clusters/highlights in graph and sets `ring_id` | FR-16–FR-19, FR-31 |
| AC-6 | Every decision has a stored SHAP record | FR-14, FR-23, NFR-9 |
| AC-7 | Copilot explanation grounded, 0 invented facts across 10 samples | FR-24–FR-27, C3 |
| AC-8 | Model-timeout injection yields rules-only degraded decision, pipeline unblocked | FR-13, NFR-5 |
| AC-9 | Consumer restart does not double-score a `txn_id` | FR-6, NFR-4 |
| AC-10 | "Shift tactics" triggers a visible drift alert | FR-4, FR-21, FR-34 |
| AC-11 | Analyst FP mark persists a label retrievable for retrain | FR-28, FR-29 |

### 9.2 Requirement → Build-Day Traceability
| Build Day (PRD §8) | Requirements covered |
|---|---|
| Day 1 | FR-1, FR-3, FR-5, FR-6, FR-10(rules), FR-13, FR-15, NFR-1(baseline), FR-32 |
| Day 2 | FR-7–FR-9, FR-10(model), FR-14, FR-23 |
| Day 3 | FR-2(mule), FR-16–FR-19, FR-31 |
| Day 4 | FR-4, FR-20, FR-21, FR-22, FR-34 |
| Day 5 | FR-30, FR-33, FR-28, FR-29 |
| Day 6 | FR-24–FR-27 |
| Day 7 | NFR-1, NFR-2, NFR-12, AC-1/AC-2 evidence, model card |

---

## 10. Glossary
| Term | Meaning |
|---|---|
| **VPA** | Virtual Payment Address (UPI handle, e.g., name@bank) |
| **Hot path** | Synchronous scoring path bound by the latency budget |
| **Feature store** | System serving precomputed features to models at low latency |
| **Train/serve skew** | Divergence between features at training vs serving time |
| **Louvain** | Community-detection algorithm used for ring discovery |
| **Mule** | Account used to move illicit funds; part of a ring |
| **PSI / KS** | Population Stability Index / Kolmogorov–Smirnov drift tests |
| **SHAP** | Shapley-value feature attributions for explainability |
| **RAG** | Retrieval-Augmented Generation |
| **Degraded mode** | Rules-only fallback when the model is unavailable/slow |
| **PR-AUC** | Area under precision-recall curve (imbalance-appropriate) |
| **Champion/Challenger** | Live model vs candidate model compared before promotion |

---

*End of SRS v1.0 (One-Week MVP). Companion: `FraudMesh_PRD.md`.*
