# helm-scaffold: Day-2 — upgrade and rollback

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/12
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Extend the Session Orchestrator with day-2 upgrade and rollback workflows. Upgrade re-runs the validator and then applies `helm upgrade` against the existing release. Rollback shows `helm history` output and prompts for a revision number, then runs `helm rollback`. Both workflows are triggerable by natural language (e.g. "upgrade my release", "roll back to the previous version").

## Acceptance criteria

- [ ] Upgrade workflow re-runs validate.sh before applying `helm upgrade`; upgrade is blocked if validation fails
- [ ] Upgrade workflow displays a diff summary (via `helm diff upgrade` if the plugin is available, otherwise a reminder to review changes) before confirming
- [ ] Rollback workflow runs `helm history <release> -n <namespace>` and displays the output
- [ ] Rollback prompts for the target revision number before executing `helm rollback`
- [ ] Both workflows verify release and namespace using `<app>-<env>` naming convention
- [ ] Both workflows are triggerable by natural language inputs (upgrade, rollback, revert, redeploy)

## Blocked by

- [#10 — Session Orchestrator: guided day-1 deploy](https://github.com/eshleebien/miniature-octo-invention/issues/10)
