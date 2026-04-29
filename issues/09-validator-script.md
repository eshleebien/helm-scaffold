# helm-scaffold: Validator script

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/9
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Bundle a `validate.sh` script with the skill that runs `helm lint` followed by `helm upgrade --install --dry-run` against a generated chart. The script accepts release name, chart path, namespace, and an optional environment suffix (used to merge `values.<env>.yaml` on top of `values.yaml`). It exits non-zero on any lint error or dry-run failure, printing the error clearly.

## Acceptance criteria

- [ ] `validate.sh <release> <chart-path> <namespace>` runs lint + dry-run with `values.yaml` only
- [ ] `validate.sh <release> <chart-path> <namespace> <env>` merges `values.yaml` and `values.<env>.yaml` in the dry-run
- [ ] Script exits non-zero and prints a clear error message if lint fails
- [ ] Script exits non-zero and prints a clear error message if dry-run fails
- [ ] Script prints "Validation passed" and exits 0 on success
- [ ] Script is executable and included in the skill's `scripts/` directory

## Blocked by

- [#5 — Chart Generator: Deployment chart](https://github.com/eshleebien/miniature-octo-invention/issues/5)
