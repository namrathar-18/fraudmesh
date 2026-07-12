# 🛡️ FraudMesh — Real-Time Payment Fraud Detection Platform

**Score every payment in under 100 ms. Detect fraud *rings*, not just fraudulent transactions. Adapt as fraudsters change tactics. Explain every decision in plain language.**

FraudMesh is an enterprise fraud-operations console for UPI-scale payments. It scores every transaction inside the authorization window, uncovers mule networks with graph intelligence, adapts to concept drift, maps fraud geographically, and gives analysts an AI copilot that grounds every explanation in real evidence.

🔗 **Live:** https://namrathar-18.github.io/fraudmesh/

---

## Sign in

The console has role-based access control. Each role lands on the workspace most relevant to their job and sees a different set of modules.

| Role | Email | Password |
|---|---|---|
| Fraud Analyst | `analyst@fraudmesh.io` | `Analyst@2025` |
| Platform Admin | `admin@fraudmesh.io` | `Admin@2025` |
| ML Engineer | `ml@fraudmesh.io` | `MLOps@2025` |
| Compliance Officer | `compliance@fraudmesh.io` | `Comply@2025` |

Or use the **Sign in by role** buttons on the login screen.

---

## Modules

- **Executive Overview** — role-aware KPIs: ₹ fraud prevented, throughput, p99 latency, active rings, detection quality, fraud composition.
- **Live Monitoring** — every payment scored in real time with decision, score and reasons; live p50/p95/p99 latency against the 100 ms SLO.
- **Graph Intelligence** — account money-flow graph with Louvain community detection and PageRank mule scoring; rings cluster and glow.
- **Geographic Map** — live transaction geography on an interactive map; fraud clusters surface as red hotspots.
- **Investigations** — filterable case queue with SLA, status and analyst labelling.
- **AI Copilot** — a grounded fraud-analyst assistant that explains decisions using the stored SHAP record, graph proximity and retrieved similar cases — it never invents facts.
- **Model Ops** — model registry, champion/challenger with shadow evaluation, feature importance, drift (PSI).
- **Rules Engine** — hot-path rule catalogue, decision thresholds and the model-timeout fallback policy.
- **Analytics & Reports** — savings, throughput and latency trends, attack mix, confusion matrix.
- **Compliance & Audit** — immutable decision log with a stored SHAP explainability record per decision.
- **Administration** — users & RBAC, service integrations, feature flags (admin only).

---

## How it works

The whole pipeline runs live in the browser — a working system, not a mockup:

```
Simulator → feature store (rolling TTL windows) → two-tier scoring (rules + LightGBM-style model)
          → SHAP explainability → async graph service (rings + mule scores)
          → drift detector (PSI) → champion/challenger retraining → analyst feedback loop
```

The scoring, SHAP attribution, graph community detection, PageRank mule scoring, PSI drift and champion/challenger logic are all genuine algorithms. The transaction stream is a realistic simulator (real UPI fraud data is confidential), and it can **shift fraud tactics mid-session** to prove the drift detector adapts — use **Inject drift** in the sidebar.

### Senior-engineering decisions
- **Two-tier scoring** — cheap rules + cached features answer inside budget; graph features are computed asynchronously and enrich the *next* transaction.
- **Degraded mode** — if the model circuit-breaker opens, we fall back to the faster rules-only path with a conservative fail-safe rather than blow the budget.
- **No train/serve skew** — a single shared feature module runs in both training and serving.
- **Class imbalance handled honestly** — evaluated with precision/recall, not accuracy.
- **Merchants allowlisted** — high-fan-in sinks are excluded from ring analysis, exactly as a real platform would.

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/fraudmesh/
npm run build    # production build to dist/
npm run preview  # serve the production build
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages automatically.

To deploy on **Vercel** instead: import the repo, framework preset **Vite**, build `npm run build`, output `dist`, and change `base` in `vite.config.ts` from `/fraudmesh/` to `/`.

## Tech

React 18 · TypeScript · Vite · React Router · Leaflet + OpenStreetMap · Canvas/SVG visualisations. No backend required — fully client-side and hostable anywhere static.

See [PRD.md](PRD.md) and [SRS.md](SRS.md) for the full product and requirements specifications.

---

Built by [Namratha R](https://github.com/namrathar-18) · [Portfolio](https://namrathar-18.github.io/portfolio/)
