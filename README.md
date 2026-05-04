# helm-scaffold

A [Claude Code](https://claude.ai/code) skill for AI-guided Helm chart scaffolding and lifecycle management on EKS.

`helm-scaffold` scans your source code, generates a production-ready Helm chart from scratch, creates least-privilege IAM policies with EKS Pod Identity, wires up External Secrets Operator backed by SSM Parameter Store, and guides you through the full deployment lifecycle — all in a single Claude conversation.

## Install

**Global** (available in all your projects):
```bash
npx helm-scaffold-skill
```

**Project-local** (scoped to the current repo):
```bash
npx helm-scaffold-skill --local
```

## What it does

### Day 1 — Scaffold and deploy

1. **Scans** your repo for signals: `docker-compose.yml`, `Dockerfile`, AWS SDK imports, env var names, `.env.example`, `serverless.yml`
2. **Generates** a complete Helm chart from scratch — no `helm create` boilerplate
3. **Generates** per-environment `values.yaml` files with opinionated defaults (HPA, probes, resource limits)
4. **Generates** a least-privilege customer-managed IAM policy and EKS Pod Identity association commands
5. **Validates** with `helm lint` + dry-run before touching your cluster
6. **Deploys** to a kubecontext you select at runtime

### Day 2 — Lifecycle management

- **Upgrade** — re-validates then runs `helm upgrade`
- **Rollback** — shows release history and rolls back to a chosen revision
- **Troubleshoot** — runs `helm status`, `helm history`, `kubectl describe pod`, and `kubectl logs`; automatically adds `--previous` when `CrashLoopBackOff` is detected

## Key design decisions

| Concern | Choice |
|---|---|
| Workload | Deployment (default) or StatefulSet (auto-detected) |
| Ingress | AWS Load Balancer Controller (ALB) |
| Image registry | ECR (inferred from `docker-compose.yml`) |
| Secrets | External Secrets Operator → SSM Parameter Store |
| IAM | Customer-managed, least-privilege; EKS Pod Identity (not IRSA) |
| Naming | `<app>-<env>` for release, namespace, service account, and IAM role |
| HTTPS | Prompts for ACM certificate ARN; double-confirms HTTP-only |

## Trigger phrases

Say any of these in Claude Code to activate the skill:

- *"scaffold a helm chart"*
- *"deploy my app to EKS"*
- *"generate helm chart"*
- *"upgrade my release"*
- *"roll back my release"*
- *"troubleshoot my release"*
- *"why is my pod crashing"*

## Requirements

- [Claude Code](https://claude.ai/code)
- `helm` ≥ 3
- `kubectl` configured with your cluster contexts
- `aws` CLI (for running the generated IAM commands)
- External Secrets Operator installed on your cluster
- AWS Load Balancer Controller installed on your cluster

## Development

```bash
cd helm-scaffold
npm install
npm test        # run all tests
npm run build   # bundle src/cli.ts → dist/cli.bundle.js
```

The TypeScript source lives in `helm-scaffold/src/`. The skill instructions are in `helm-scaffold/SKILL.md`.
