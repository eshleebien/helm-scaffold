# helm-scaffold: Chart Generator — Deployment chart

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/5
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Implement the Chart Generator for Deployment workloads. Given a SignalMap and user config (app name, namespace, image URI, container port), generate a complete Helm chart from scratch — no `helm create`. Output includes: Chart.yaml, templates/deployment.yaml (with resource limits, liveness/readiness probes, and env vars from SignalMap), templates/service.yaml, templates/ingress.yaml (AWS Load Balancer Controller annotations), templates/serviceaccount.yaml, templates/hpa.yaml (CPU-based, 70% target), templates/externalsecret.yaml (ESO backed by SSM Parameter Store), and templates/\_helpers.tpl. `helm lint` must pass on all generated output.

## Acceptance criteria

- [ ] Chart.yaml contains correct apiVersion, name, and version fields
- [ ] deployment.yaml includes resource requests/limits, liveness probe, readiness probe, and env vars derived from SignalMap
- [ ] service.yaml targets the correct container port
- [ ] ingress.yaml includes AWS Load Balancer Controller annotations (`kubernetes.io/ingress.class: alb`, `alb.ingress.kubernetes.io/scheme: internet-facing`)
- [ ] serviceaccount.yaml uses `<app>-<env>` naming and includes the Pod Identity annotation
- [ ] hpa.yaml targets CPU utilisation at 70% with configurable min/max replicas
- [ ] externalsecret.yaml references SSM Parameter Store via ESO with correct store and key references
- [ ] `helm lint` passes on the generated chart with no errors or warnings

## Blocked by

- [#2 — skill scaffold + Scanner (docker-compose & Dockerfile)](https://github.com/eshleebien/miniature-octo-invention/issues/2)
