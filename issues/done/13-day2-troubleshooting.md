# helm-scaffold: Day-2 — troubleshooting

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/13
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Extend the Session Orchestrator with a troubleshooting workflow. When a deploy fails or the user asks to diagnose a release, the orchestrator surfaces: `helm status`, `helm history`, `kubectl describe pod` (filtered by `app.kubernetes.io/instance=<release>`), and `kubectl logs` (last 100 lines, with `--previous` for CrashLoopBackOff). The workflow is triggerable by natural language (e.g. "something is broken", "why is my pod crashing", "troubleshoot my release").

## Acceptance criteria

- [ ] Troubleshoot workflow runs `helm status <release> -n <namespace>` and displays output
- [ ] Troubleshoot workflow runs `helm history <release> -n <namespace>` and displays output
- [ ] Troubleshoot workflow runs `kubectl describe pod -l app.kubernetes.io/instance=<release> -n <namespace>` and displays output
- [ ] Troubleshoot workflow runs `kubectl logs -l app.kubernetes.io/instance=<release> -n <namespace> --tail=100` and displays output
- [ ] Workflow adds `--previous` flag to logs command when CrashLoopBackOff is detected in describe output
- [ ] Workflow is triggerable by natural language inputs (troubleshoot, debug, broken, crashing, failing, diagnose)

## Blocked by

- [#10 — Session Orchestrator: guided day-1 deploy](https://github.com/eshleebien/miniature-octo-invention/issues/10)
