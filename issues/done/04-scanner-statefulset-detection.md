# helm-scaffold: Scanner — StatefulSet detection

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/4
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Extend the Scanner to detect whether the workload requires a StatefulSet rather than a Deployment. Detection fires on any of three signals: named volumes in docker-compose (app owns persistent storage), database-adjacent environment variable names (POSTGRES\_\*, DATABASE\_URL, MYSQL\_\*, REDIS\_URL), or existing PersistentVolumeClaim manifests found anywhere in the repo. When any signal fires, the SignalMap sets `statefulSetCandidate: true` — the Session Orchestrator will use this to prompt the user. Include tests.

## Acceptance criteria

- [ ] Scanner sets `statefulSetCandidate: true` when docker-compose defines named volumes
- [ ] Scanner sets `statefulSetCandidate: true` when env vars match database-adjacent patterns (POSTGRES\_\*, DATABASE\_URL, MYSQL\_\*, REDIS\_URL)
- [ ] Scanner sets `statefulSetCandidate: true` when any PersistentVolumeClaim manifest exists in the repo
- [ ] Scanner correctly returns `statefulSetCandidate: false` when none of the three signals are present
- [ ] Tests pass for each signal variant independently and in combination

## Blocked by

- [#2 — skill scaffold + Scanner (docker-compose & Dockerfile)](https://github.com/eshleebien/miniature-octo-invention/issues/2)
