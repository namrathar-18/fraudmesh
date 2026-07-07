# 🕸️ FraudMesh — Real-Time Payment Fraud Detection

> A streaming platform that scores every payment in **under 100 ms**, detects fraud *rings* (not just fraudulent transactions) using graph intelligence, and gives analysts an AI copilot that explains every blocked transaction in plain language.

![status](https://img.shields.io/badge/status-in%20build-orange) ![stack](https://img.shields.io/badge/stack-Python%20%C2%B7%20LightGBM%20%C2%B7%20Redis%20%C2%B7%20Redpanda-blue)

## The core loop

A simulator fires realistic UPI-like transactions into a Redpanda stream → a sub-100 ms scoring service (rules + LightGBM + Redis online feature store) blocks fraud → a graph view surfaces mule rings via Louvain community detection → an AI copilot explains each decision — with a live p99 latency panel to prove the SLO.

## What it proves

- **Latency SLO, honestly measured** — p99 < 100 ms shown live and captured with load-test numbers.
- **No train/serve skew** — one shared feature library computes rolling features (with TTL semantics) in both training and the online store.
- **Class imbalance handled properly** — PR-AUC, not accuracy.
- **Graph intelligence** — the account/device/transaction graph clusters mule rings; ring membership feeds the next score.
- **Explainability end to end** — per-decision SHAP values stored with every score and narrated by the copilot, which never invents facts.
- **Closed loop** — analysts flag false positives; labels persist for retraining.

## Documents

| Doc | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Product requirements — vision, one-week MVP scope, goals & non-goals |
| [SRS.md](SRS.md) | Software Requirements Specification — functional & non-functional requirements |

## Roadmap

k3s-on-EC2 deployment, MLflow champion/challenger promotion, GraphSAGE ring detection, and multi-node streaming — parked for post-MVP; the vertical slice proves the loop first.

---

Built by [Namratha R](https://github.com/namrathar-18) · [Portfolio](https://namrathar-18.github.io/portfolio/)
