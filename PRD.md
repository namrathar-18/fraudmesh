# FraudMesh — Product Requirements Document (PRD)
### One-Week MVP Edition

> **Live demo:** https://namrathar-18.github.io/fraudmesh/
>
> **Sign in (role-based access control):**
>
> | Role | Email | Password |
> |---|---|---|
> | Fraud Analyst | `analyst@fraudmesh.io` | `Analyst@2025` |
> | Platform Admin | `admin@fraudmesh.io` | `Admin@2025` |
> | ML Engineer | `ml@fraudmesh.io` | `MLOps@2025` |
> | Compliance Officer | `compliance@fraudmesh.io` | `Comply@2025` |

| Field | Value |
|---|---|
| **Product** | FraudMesh — Real-Time Payment Fraud Detection Platform |
| **Author** | namrp.18@gmail.com |
| **Version** | 1.0 (One-Week MVP) |
| **Date** | 2026-07-05 |
| **Status** | Draft — for build |
| **Timebox** | 7 days (single developer) |

---

## 1. Purpose & Vision

**Vision (north star):** A streaming platform that scores every payment in under 100 ms, detects fraud *rings* (not just fraudulent transactions) using graph intelligence, adapts to drift as fraudsters change tactics, and gives human analysts an AI copilot that explains every blocked transaction in plain language.

**This document scopes the *one-week MVP*** — a demonstrable, end-to-end vertical slice that proves the core loop and is defensible in a fintech interview. The full multi-service, k3s-on-EC2, MLflow-champion/challenger vision is explicitly **out of scope for week one** and captured in §9 (Post-MVP Roadmap).

### 1.1 The one-sentence MVP
> A local pipeline where a simulator fires realistic UPI-like transactions, a sub-100 ms scoring service (rules + LightGBM + feature store) blocks fraud, a graph view surfaces mule rings, and an AI copilot explains each decision in plain language — with a live p99 latency panel to prove the SLO.

---

## 2. Goals & Non-Goals

### 2.1 Goals (must be true at end of week)
1. **G1 — Latency SLO proven.** Score p99 < 100 ms on a laptop, shown live on a latency panel and captured in the README with load-test numbers.
2. **G2 — Real detection.** A supervised model (LightGBM) + rules produce a fraud score and block/allow decision; class imbalance handled honestly (PR-AUC, not accuracy).
3. **G3 — Feature store.** Rolling online features (Redis) with TTL semantics, computed by *shared* code used in both training and serving (no train/serve skew).
4. **G4 — Graph intelligence.** Account/device/transaction graph with community detection (Louvain) that visibly clusters a mule ring; ring membership feeds the next score.
5. **G5 — Explainability.** Per-decision SHAP values stored with every score.
6. **G6 — AI copilot.** Given a blocked transaction, retrieves context (SHAP record, account history, ring neighbors, similar past cases) and narrates a plain-language explanation — never inventing facts.
7. **G7 — Closed loop (lite).** Analyst can mark a case false-positive; the label is persisted for retraining.
8. **G8 — Demo-ready dashboard.** Live scored stream, ring graph, latency panel, case queue, copilot panel.

### 2.2 Non-Goals (explicitly deferred)
- Kubernetes / k3s / EC2 deployment (local Docker Compose only).
- MLflow-based champion/challenger promotion pipeline (simulated, not automated).
- GraphSAGE / deep graph nets (Louvain + PageRank-style scores only).
- Real Kafka cluster tuning, exactly-once guarantees at scale (single-node Redpanda; idempotency keys only).
- Production auth, multi-tenancy, RBAC.
- Real 3D Three.js polish — a 2D/3D force graph that *clusters rings* is enough for MVP; 3D is a stretch.

---

## 3. Target Users & Personas

| Persona | Need | MVP touchpoint |
|---|---|---|
| **Fraud Analyst (primary)** | Understand *why* a txn was blocked; triage the queue fast; flag false positives | Dashboard case queue + copilot explanation + FP button |
| **ML/Platform Engineer (you, the builder)** | Defend latency, feature freshness, drift, imbalance decisions | Latency panel, feature store, model card in README |
| **Interviewer (evaluation audience)** | See a live, coherent system with senior-engineer trade-offs | The whole demo + README design section |

---

## 4. User Stories (MVP)

- **US1:** As an analyst, I see a live stream of scored transactions with score, decision, and top reasons.
- **US2:** As an analyst, I click a blocked transaction and read a plain-language explanation grounded in SHAP + graph + history.
- **US3:** As an analyst, I see a graph where a mule ring visibly clusters and glows.
- **US4:** As an analyst, I mark a decision as false-positive and it is recorded.
- **US5:** As a builder, I watch a live p50/p95/p99 latency panel while the simulator runs at load.
- **US6:** As a builder, I trigger the simulator to *change fraud tactics* mid-demo and see a drift alert fire.

---

## 5. Functional Scope (MVP)

### 5.1 Transaction Simulator
- Emits UPI-like events: `{txn_id, timestamp, payer_vpa, payee_vpa, amount, device_id, ip, channel}`.
- Legitimate traffic patterns + injectable fraud scenarios: **account takeover**, **mule fan-in/fan-out**, **laundering chain**.
- Idempotency key per txn. Configurable TPS. A "shift tactics" toggle to demonstrate drift.

### 5.2 Stream + Scoring Service (hot path, <100 ms budget)
- Consumes events; **two-tier scoring**:
  1. Cheap **rules** + cached features from Redis → in-budget decision.
  2. **LightGBM** score using online features.
- Graph features are **not** in the hot path — they enrich the account profile *asynchronously* for the *next* txn.
- **Fallback/degraded mode:** if model call exceeds budget → rules-only decision (configurable: the default is conservative *review*, documented as a business trade-off).
- Writes decision + SHAP + feature snapshot to Postgres.

### 5.3 Online Feature Store
- Redis-backed rolling aggregates: txns in last 5 min, distinct devices in 24 h, amount vs. user median, payee in-degree, etc.
- Exact **TTL semantics**; **same feature code path** for training and serving.

### 5.4 Graph Service (async)
- Builds account–device–txn graph (NetworkX for MVP).
- **Louvain** community detection → ring IDs; PageRank-style **mule score** per node.
- Exposes `get_ring_neighbors(account)` and ring membership back to the feature store.

### 5.5 Anomaly + Drift (lite)
- **Isolation Forest** flags novel anomalies the supervised model misses.
- **PSI/KS** on a couple of key feature distributions → drift alert banner when the simulator shifts tactics.

### 5.6 AI Copilot (RAG + tools)
- Tools: `get_account_history()`, `get_ring_neighbors()`, `similar_cases()`, `get_shap_record()`.
- Retrieves similar past cases (pgvector or in-memory vector search for MVP) + fraud-pattern playbook snippets.
- Produces a grounded narration; **must cite the SHAP/graph facts it used and must not invent**.

### 5.7 Analyst Dashboard (Next.js / React + Vite)
- Live scored stream (WebSocket).
- Force-directed ring graph (2D acceptable; 3D Three.js = stretch).
- p50/p95/p99 latency panel.
- Case queue + detail drawer with copilot explanation + **Mark False-Positive** button.

---

## 6. Success Metrics (Definition of Done)

| # | Metric | Target |
|---|---|---|
| M1 | Scoring p99 latency (local, steady load) | < 100 ms |
| M2 | Sustained throughput | ≥ 200 TPS locally (report the real number) |
| M3 | Model PR-AUC on held-out fraud | Reported honestly (target ≥ 0.80 on synthetic) |
| M4 | Ring detection | ≥ 1 injected mule ring visibly clustered & flagged |
| M5 | Copilot groundedness | 0 invented facts across 10 sampled explanations |
| M6 | Closed loop | FP labels persisted and retrievable for retrain |
| M7 | Drift demo | Tactic shift triggers a visible drift alert |

---

## 7. Architecture (MVP — local)

```
Txn Simulator ──► Redpanda (single node)
                       │ consume
                 Scoring svc (FastAPI, <100ms)
                   │            │            │
        Redis feature store  Postgres    (async) Graph svc (NetworkX)
                   │         decisions/       │ Louvain + mule score
                   │         SHAP/labels       └─► enrich next score
                   │
        Copilot svc (RAG + tools, pgvector)
                   │
   React/Vite dashboard  ◄─WebSocket─►  API gateway  ·  Force graph  ·  Latency panel
```

Everything runs via **Docker Compose** on one machine. No Kubernetes in week one.

---

## 8. One-Week Build Plan (day-by-day)

> Sequenced so there is a *working, demoable slice* every single day. If a day slips, the earlier days still demo.

| Day | Theme | Deliverable (demoable) | Maps to |
|---|---|---|---|
| **Day 1** | Skeleton + hot path | Docker Compose (Redpanda, Redis, Postgres). Simulator → Kafka → scoring svc with **rules only** + **latency instrumentation**. p99 panel shows numbers. | G1 |
| **Day 2** | Feature store + model | Redis rolling features (shared code). Train LightGBM on synthetic labels; wire into scoring; store **SHAP** per decision. PR-AUC reported. | G2, G3, G5 |
| **Day 3** | Graph + rings | NetworkX graph, Louvain rings, mule score; inject a mule network in simulator; ring membership enriches next score. | G4 |
| **Day 4** | Anomaly + drift | Isolation Forest; PSI/KS drift check; simulator "shift tactics" toggle → drift alert. | G2, M7 |
| **Day 5** | Dashboard | React/Vite: live stream, case queue + drawer, latency panel, force graph (2D), **Mark FP** → persists label. | G7, G8 |
| **Day 6** | Copilot | RAG over cases/playbooks + tools; grounded explanation in the drawer; groundedness check. | G6 |
| **Day 7** | Harden + prove | k6/locust load test; capture p50/p95/p99 + TPS in README; Grafana or in-app latency panel; model card; demo script + README design section. | M1, M2 |

**Buffer strategy:** 3D Three.js graph, pgvector (vs in-memory vectors), and Grafana are all "if time remains." The dashboard's own latency panel satisfies M1 without Grafana.

---

## 9. Post-MVP Roadmap (out of scope for week one)
- k3s on free-tier EC2, Redpanda single binary, ECR + GitHub Actions CI/CD, S3 model artifacts.
- MLflow champion/challenger with automated shadow-scoring and promotion.
- GraphSAGE node embeddings.
- Feature-store sharding design for 100× traffic.
- Prometheus/Grafana production dashboards, alerting.
- Real 3D Three.js ring visualization with spatial clustering animation.

---

## 10. Key Design Decisions to Defend (interview ammo)
1. **LightGBM over a neural net** — latency budget: milliseconds of inference, tabular features, native SHAP.
2. **What's in the hot path vs async** — graph queries can't meet 100 ms; enrich next txn instead.
3. **Fallback policy** — model timeout → rules-only degraded mode; conservative default; business trade-off of FP vs FN.
4. **Train/serve skew avoidance** — single shared feature-computation module.
5. **Class imbalance honestly** — PR curves and cost asymmetry (₹ cost of FN ≫ FP), not accuracy.
6. **Why graphs** — per-transaction models miss mule *networks*; rings need community detection.

---

## 11. Risks & Mitigations (one-week)
| Risk | Mitigation |
|---|---|
| Scope creep beyond 7 days | Non-Goals (§2.2) are hard boundaries; daily demoable slices |
| Latency budget missed | Rules-only path always in-budget; profile Day 1; keep model features few |
| Copilot hallucinates | Tools return structured facts; prompt forbids invention; groundedness check (M5) |
| Synthetic data unrealistic | Model claims framed as "on synthetic data"; focus is systems design, not SOTA metrics |
| Time sink on 3D graph | 2D force graph is the committed target; 3D is stretch only |

---

## 12. Deliverables Checklist
- [ ] `docker-compose.yml` bringing the stack up with one command
- [ ] Simulator with fraud scenarios + tactic-shift toggle
- [ ] Scoring service with two-tier scoring + fallback + latency instrumentation
- [ ] Redis feature store (shared feature code)
- [ ] LightGBM model + training script + SHAP storage
- [ ] Graph service (Louvain + mule score)
- [ ] Isolation Forest + PSI/KS drift check
- [ ] Copilot service (RAG + tools)
- [ ] Dashboard (stream, queue, graph, latency panel, FP button)
- [ ] k6/locust load test + README with p99/TPS numbers, model card, design rationale
- [ ] `FraudMesh_SRS.md` (companion document)
