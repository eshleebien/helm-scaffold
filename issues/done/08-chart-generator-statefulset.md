# helm-scaffold: Chart Generator — StatefulSet variant

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/8
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Extend the Chart Generator to produce a StatefulSet-based chart when the SignalMap has `statefulSetCandidate: true` and the user confirms the StatefulSet workload type. The StatefulSet chart replaces deployment.yaml with statefulset.yaml (including VolumeClaimTemplates) and removes the HPA (StatefulSets are not HPA-compatible by default). All other chart files (service, ingress, serviceaccount, externalsecret, \_helpers.tpl) remain unchanged. `helm lint` must pass on the generated StatefulSet chart.

## Acceptance criteria

- [ ] Chart Generator produces statefulset.yaml (not deployment.yaml) when `statefulSetCandidate: true` and user confirms
- [ ] statefulset.yaml includes VolumeClaimTemplates with configurable storage size and storageClass
- [ ] HPA manifest is omitted from StatefulSet charts
- [ ] All other chart files are identical to the Deployment variant
- [ ] `helm lint` passes on the generated StatefulSet chart with no errors or warnings
- [ ] Chart Generator still produces a Deployment chart when user declines the StatefulSet prompt despite `statefulSetCandidate: true`

## Blocked by

- [#4 — Scanner: StatefulSet detection](https://github.com/eshleebien/miniature-octo-invention/issues/4)
- [#5 — Chart Generator: Deployment chart](https://github.com/eshleebien/miniature-octo-invention/issues/5)
