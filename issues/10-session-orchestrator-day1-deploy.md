# helm-scaffold: Session Orchestrator — guided day-1 deploy

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/10
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Implement the Session Orchestrator — the guided conversation flow that wires all generators into a single end-to-end session. The orchestrator collects app name, target environments, and kubecontext (presenting options via `kubectl config get-contexts`), then runs: Scanner → IAM Generator → Chart Generator → Values Generator → Validator → deploy. It pauses for user confirmation at each phase before proceeding. The session ends with a successful `helm upgrade --install` against the selected kubecontext. Release, namespace, and service account all follow `<app>-<env>` naming. The skill is triggerable by natural language (e.g. "scaffold a helm chart", "deploy my app to EKS").

## Acceptance criteria

- [ ] Orchestrator collects app name, environments, and kubecontext via guided prompts
- [ ] Kubecontext selection lists available contexts from `kubectl config get-contexts`
- [ ] Each phase (scan, IAM, chart, values, validate, deploy) presents a summary and awaits confirmation before proceeding
- [ ] IAM CLI commands are displayed for user to run manually (with confirmation checkpoint) before deploy proceeds
- [ ] Validator script is run automatically before deploy; deploy is blocked if validation fails
- [ ] Final deploy uses `helm upgrade --install <app>-<env> <chart-path> -n <app>-<env> --create-namespace -f values.yaml -f values.<env>.yaml`
- [ ] Namespace and service account follow `<app>-<env>` naming throughout
- [ ] Skill triggers correctly from natural language inputs referencing helm, deploy, scaffold, or EKS

## Blocked by

- [#7 — IAM Generator](https://github.com/eshleebien/miniature-octo-invention/issues/7)
- [#5 — Chart Generator: Deployment chart](https://github.com/eshleebien/miniature-octo-invention/issues/5)
- [#6 — Values Generator](https://github.com/eshleebien/miniature-octo-invention/issues/6)
- [#9 — Validator script](https://github.com/eshleebien/miniature-octo-invention/issues/9)
