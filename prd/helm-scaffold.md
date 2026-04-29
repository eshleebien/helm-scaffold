# helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/1

## Problem Statement

Engineers deploying their own application images to EKS must manually author Helm charts, construct values files per environment, configure EKS Pod Identity IAM roles and policies with appropriate least-privilege permissions, wire up External Secrets Operator manifests for SSM Parameter Store, and manage the full release lifecycle — all from scratch each time. This process is error-prone, time-consuming, and inconsistently applied across teams. There is no guided, opinionated workflow that takes a source codebase and produces a production-ready Helm release on EKS.

## Solution

A Claude Code skill (`helm-scaffold`) that runs as a single guided session from source code to deployed release. The skill scans the codebase for signals (docker-compose, Dockerfile, SDK imports, env vars), generates a complete Helm chart from scratch, produces per-environment values files, creates least-privilege IAM policies and EKS Pod Identity associations via AWS CLI, scaffolds External Secrets Operator manifests backed by SSM Parameter Store, validates with lint and dry-run, and deploys to a user-selected kubecontext. The skill also handles all day-2 operations: upgrades, rollbacks, and troubleshooting — making it a standalone, end-to-end Helm lifecycle tool for EKS.

## User Stories

1. As an engineer, I want the skill to scan my docker-compose file so that the chart is pre-populated with the correct image, ports, and environment variables without manual entry.
2. As an engineer, I want the skill to scan my Dockerfile so that the container port is correctly inferred from the `EXPOSE` directive.
3. As an engineer, I want the skill to scan my env var names for AWS service patterns so that I don't have to manually identify which AWS services my app uses.
4. As an engineer, I want the skill to scan my source code for AWS SDK imports (boto3, @aws-sdk/\*, aws-sdk) so that AWS service dependencies are detected even when not reflected in env vars.
5. As an engineer, I want the skill to scan config files (.env.example, serverless.yml) for additional AWS resource signals so that the IAM policy is as complete as possible.
6. As an engineer, I want the skill to detect StatefulSet requirements from named volumes in docker-compose, database-adjacent env vars, and existing PVC manifests so that I am prompted to choose the correct workload type before generating the chart.
7. As an engineer, I want the skill to generate a Helm chart from scratch (not from `helm create`) so that the output contains only what is needed with no boilerplate.
8. As an engineer, I want the generated chart to include a Deployment manifest with opinionated defaults so that I do not have to write resource limits, probes, or labels from scratch.
9. As an engineer, I want the generated chart to include an optional StatefulSet manifest so that stateful workloads are supported with the same guided workflow.
10. As an engineer, I want the generated chart to include a Service manifest so that the app is reachable within the cluster.
11. As an engineer, I want the generated chart to include an Ingress manifest with AWS Load Balancer Controller annotations so that ALB routing is correctly configured without referencing documentation.
12. As an engineer, I want the generated chart to include a ServiceAccount manifest so that the Pod Identity association has a concrete target.
13. As an engineer, I want the generated chart to include an HPA manifest with CPU-based scaling at 70% threshold so that the app scales automatically under load.
14. As an engineer, I want the generated chart to include an ExternalSecret manifest backed by SSM Parameter Store so that secrets are injected via External Secrets Operator without storing them in the repo.
15. As an engineer, I want the skill to prompt me for which environments I need (dev/staging/prod) so that only the relevant values files are generated.
16. As an engineer, I want the skill to generate a base `values.yaml` with opinionated defaults so that all required fields are pre-filled and I only override what differs per environment.
17. As an engineer, I want per-environment values files (`values.dev.yaml`, `values.staging.yaml`, `values.prod.yaml`) with environment-appropriate replica counts and resource sizes so that I don't accidentally run prod settings in dev.
18. As an engineer, I want the HPA replica defaults to be pre-set per environment (dev: 1–2, staging: 2–4, prod: 3–10) so that scaling behaviour is safe out of the box.
19. As an engineer, I want the skill to infer the ECR image URI from my docker-compose `image:` field so that the chart references the correct registry without manual input.
20. As an engineer, I want the skill to prompt me for the ACM certificate ARN when I choose HTTPS so that the ALB is correctly configured for TLS termination.
21. As an engineer, I want the skill to prompt me twice before proceeding with HTTP-only ingress so that I don't accidentally deploy without TLS in production.
22. As an engineer, I want the skill to generate a least-privilege customer-managed IAM policy based on detected AWS service signals so that the app has only the permissions it needs.
23. As an engineer, I want the generated IAM policy to reference specific resource ARNs (e.g. actual SSM parameter paths, S3 bucket names) where they can be inferred from env vars or config files so that the policy is not overly broad.
24. As an engineer, I want the skill to use `<RESOURCE_NAME>` placeholders in the IAM policy where specific resource names cannot be inferred so that I know exactly what to fill in.
25. As an engineer, I want the skill to generate the `aws iam create-policy` command so that I can create the IAM policy with a single command.
26. As an engineer, I want the skill to generate the `aws iam create-role` command with the correct EKS Pod Identity trust policy so that the role is ready for pod identity association.
27. As an engineer, I want the skill to generate the `aws iam attach-role-policy` command so that the policy is attached to the role correctly.
28. As an engineer, I want the skill to generate the `aws eks create-pod-identity-association` command with the correct namespace and service account so that the pod identity binding is complete.
29. As an engineer, I want namespaces and service accounts to follow the `<app>-<env>` naming convention so that resources are consistently named and auditable across environments.
30. As an engineer, I want the skill to list available kubecontexts at deploy time so that I can select the target cluster without memorising ARNs.
31. As an engineer, I want the skill to pause for my confirmation at each phase (scan, generate, IAM, validate, deploy) so that I remain in control of every irreversible action.
32. As an engineer, I want the skill to run `helm lint` and a dry-run before deploying so that configuration errors are caught before they affect the cluster.
33. As an engineer, I want the skill to run `helm upgrade --install` for the initial deploy so that the same command works for both first installs and idempotent re-runs.
34. As an engineer, I want the skill to support upgrading an existing release so that I can use it for day-2 operations without switching tools.
35. As an engineer, I want the skill to support rolling back a release to a previous revision so that I can recover from a bad deploy quickly.
36. As an engineer, I want the skill to surface troubleshooting commands (pod events, logs, helm history) when a deployment fails so that I can diagnose issues without leaving the workflow.
37. As an engineer, I want the skill to be entirely standalone so that I do not need any other helm skill installed.
38. As an engineer, I want the skill to be triggered by natural language (e.g. "scaffold a helm chart", "deploy my app to EKS", "roll back my release") so that I do not need to remember specific commands.

## Implementation Decisions

### Modules

**Scanner**
- Parses docker-compose (image, ports, volumes, environment), Dockerfile (EXPOSE, base image), env var files (.env.example), SDK import files, and config files (serverless.yml)
- Outputs a structured signal map: detected AWS services, env var names with resource hints, inferred image URI, inferred container port, volume presence, existing PVC manifests
- StatefulSet detector fires if any of: named volumes in docker-compose, database-adjacent env vars (POSTGRES_\*, DATABASE_URL, MYSQL_\*, REDIS_URL), or existing PVC manifests in the repo
- Interface: `scan(repoPath) → SignalMap`

**IAM Generator**
- Consumes the SignalMap and produces a least-privilege customer-managed IAM policy document with resource-specific ARNs where inferable, `<RESOURCE_NAME>` placeholders otherwise
- Generates the full sequence of AWS CLI commands: `create-policy`, `create-role` (with Pod Identity trust policy), `attach-role-policy`, `eks create-pod-identity-association`
- Does not use AWS managed policies
- Interface: `generateIAM(signalMap, appName, env, clusterName) → IAMCommands`

**Chart Generator**
- Produces all chart files from scratch: Chart.yaml, templates/deployment.yaml (or statefulset.yaml), templates/service.yaml, templates/ingress.yaml, templates/serviceaccount.yaml, templates/hpa.yaml, templates/externalsecret.yaml, templates/_helpers.tpl
- Ingress uses AWS Load Balancer Controller annotations
- ExternalSecret targets SSM Parameter Store via ESO
- Interface: `generateChart(signalMap, config) → ChartFiles`

**Values Generator**
- Produces `values.yaml` (opinionated base) and `values.<env>.yaml` for each requested environment
- HPA defaults: dev 1–2, staging 2–4, prod 3–10 replicas; CPU target 70%
- Includes resource limits, liveness/readiness probes, ingress hostname, ACM cert ARN (if HTTPS)
- Interface: `generateValues(signalMap, config, envs) → ValuesFiles`

**Session Orchestrator**
- Drives the full guided session: collects app name, target environments, kubecontext, HTTPS preference, ACM ARN
- Calls Scanner → IAM Generator → Chart Generator → Values Generator in sequence
- Presents checkpoint summaries and awaits confirmation before IAM creation, chart write, and deploy
- Handles day-2 operations: upgrade (re-runs validate + helm upgrade), rollback (helm history + helm rollback), troubleshoot (kubectl describe, logs, helm status)

**Validator Script**
- Shell script bundled with the skill
- Runs `helm lint` then `helm upgrade --install --dry-run`
- Supports optional env suffix for values file merging
- Interface: `validate.sh <release> <chart-path> <namespace> [env]`

### Architectural Decisions
- Chart is generated from scratch; `helm create` is not used
- All IAM is customer-managed, least-privilege; no AWS managed policies
- Secrets use External Secrets Operator backed by SSM Parameter Store (not Secrets Manager)
- Naming convention: `<app>-<env>` for release, namespace, and service account
- Ingress: AWS Load Balancer Controller only
- Image registry: ECR, inferred from docker-compose; explicit prompt as fallback
- Kubecontext selected at deploy time from `kubectl config get-contexts` output

## Testing Decisions

A good test for this skill verifies external behaviour — given a set of source code signals as input, the correct output (policy JSON, chart YAML, values YAML) is produced — without asserting on internal steps or intermediate state.

**Modules to test:**

- **Scanner** — Given a fixture repo directory with known docker-compose, Dockerfile, and env files, assert the SignalMap contains the correct inferred image, port, AWS services, and StatefulSet trigger flags. High priority: incorrect signals propagate errors to all downstream generators.
- **IAM Generator** — Given a SignalMap with known AWS service detections and resource name hints, assert the generated policy JSON contains the correct actions and resource ARNs (or correct placeholders). High priority: incorrect policies are a security issue.

**Modules not tested (orchestration/generation):**
- Chart Generator, Values Generator, Session Orchestrator — outputs are YAML/shell text verified by `helm lint` in the validator script; unit tests here would mostly assert string content and are brittle to formatting changes.

## Out of Scope

- Support for non-EKS Kubernetes clusters
- Terraform, CDK, or CloudFormation for IAM creation (AWS CLI only)
- AWS managed policy usage
- Secrets Manager (SSM Parameter Store only)
- nginx ingress controller
- Non-ECR image registries (Docker Hub, GHCR)
- Helm chart packaging and publishing to a chart registry
- CI/CD pipeline integration (GitHub Actions, ArgoCD, Flux)
- Multi-cluster federation or cross-region deployments
- CronJob or DaemonSet workload types
- Day-0 cluster provisioning (EKS cluster, node groups, add-ons)

## Further Notes

- The `helm-deploy` skill created earlier is superseded by `helm-scaffold` for this user's workflow. `helm-scaffold` is intended to be fully standalone.
- The skill should store no persistent state between sessions; every invocation is treated as fresh, relying on the current repo state and live `helm history` / `kubectl` output for context.
- The EKS Pod Identity trust policy differs from the legacy IRSA trust policy — the skill must use the Pod Identity form (`pods.eks.amazonaws.com` as the principal) and not the OIDC/IRSA form.
