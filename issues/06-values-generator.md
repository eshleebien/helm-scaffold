# helm-scaffold: Values Generator

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/6
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Implement the Values Generator. Given a SignalMap and user-selected environments, produce a base `values.yaml` with opinionated defaults (image, resources, probes, HPA, ingress, serviceAccount, externalSecret) and a `values.<env>.yaml` for each requested environment. Per-env files contain only the values that differ: replica counts, resource sizes, and ingress hostname. HPA defaults: dev min 1 max 2, staging min 2 max 4, prod min 3 max 10; CPU target 70% across all envs.

## Acceptance criteria

- [ ] `values.yaml` is generated with all required top-level keys (image, resources, probes, hpa, ingress, serviceAccount, externalSecret)
- [ ] `values.yaml` resource defaults are set to sensible non-zero values (not empty)
- [ ] Per-env files are generated only for environments the user selects
- [ ] HPA min/max replica defaults match: dev 1–2, staging 2–4, prod 3–10
- [ ] CPU target is set to 70% in base values
- [ ] Merging `values.yaml` + `values.<env>.yaml` with `-f` produces a valid, complete values set
- [ ] Ingress hostname in per-env files uses `<app>.<env>.example.com` placeholder pattern

## Blocked by

- [#2 — skill scaffold + Scanner (docker-compose & Dockerfile)](https://github.com/eshleebien/miniature-octo-invention/issues/2)
