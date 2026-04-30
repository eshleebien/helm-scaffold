# helm-scaffold: HTTPS / ACM cert prompting

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/11
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Add HTTPS configuration to the Session Orchestrator. During the values collection phase, ask the user whether they want HTTPS. If yes, prompt for the ACM certificate ARN and inject it into the ingress values as `alb.ingress.kubernetes.io/certificate-arn`. If no, ask a second time to confirm HTTP-only before proceeding — making it harder to accidentally deploy without TLS in production.

## Acceptance criteria

- [ ] Orchestrator asks "Do you want HTTPS?" during setup
- [ ] If yes: prompts for ACM certificate ARN and injects it into the ingress values for all selected environments
- [ ] Generated ingress includes `alb.ingress.kubernetes.io/certificate-arn` annotation when ACM ARN is provided
- [ ] If no: a second confirmation prompt is shown ("Are you sure you want HTTP-only? This will expose the service without TLS.")
- [ ] Deploy only proceeds after the second HTTP-only confirmation is accepted
- [ ] ACM ARN is validated as a non-empty string matching the `arn:aws:acm:` prefix before being accepted

## Blocked by

- [#10 — Session Orchestrator: guided day-1 deploy](https://github.com/eshleebien/miniature-octo-invention/issues/10)
