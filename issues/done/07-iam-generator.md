# helm-scaffold: IAM Generator

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/7
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Implement the IAM Generator. Given a SignalMap (detected AWS services + resource name hints), app name, environment, and cluster name, produce: a least-privilege customer-managed IAM policy document (JSON) with service-specific actions and resource ARNs using inferred names where available or `<RESOURCE_NAME>` placeholders otherwise, and the full sequence of AWS CLI commands to execute: `aws iam create-policy`, `aws iam create-role` (with EKS Pod Identity trust policy — not IRSA/OIDC), `aws iam attach-role-policy`, and `aws eks create-pod-identity-association`. No AWS managed policies. Include tests.

## Acceptance criteria

- [ ] Generated policy JSON contains only the actions needed for detected AWS services (e.g. `s3:GetObject`, `s3:PutObject` for S3; `ssm:GetParameter`, `ssm:GetParametersByPath` for SSM)
- [ ] Resource ARNs use inferred names from SignalMap where available, `<RESOURCE_NAME>` placeholders otherwise
- [ ] IAM role trust policy uses the EKS Pod Identity principal (`pods.eks.amazonaws.com`), not OIDC/IRSA
- [ ] All four AWS CLI commands are generated with correct flags and values
- [ ] Pod Identity association command uses `<app>-<env>` for both namespace and service account
- [ ] No AWS managed policy ARNs appear in any generated output
- [ ] Tests assert correct policy actions and resource ARN patterns for at minimum S3, SQS, SSM, and DynamoDB signal combinations

## Blocked by

- [#3 — Scanner: AWS service detection](https://github.com/eshleebien/miniature-octo-invention/issues/3)
