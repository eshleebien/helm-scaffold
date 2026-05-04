---
name: helm-scaffold
description: AI-guided Helm chart scaffolding and lifecycle management for EKS. Scans source code (docker-compose, Dockerfile, SDK imports, env vars) to generate a complete Helm chart, per-environment values files, least-privilege IAM policies with EKS Pod Identity, ExternalSecrets backed by SSM Parameter Store, and runs helm lint + dry-run before deploying to a user-selected kubecontext.
triggers:
  - scaffold a helm chart
  - deploy my app to EKS
  - generate helm chart
  - helm scaffold
  - create helm chart for EKS
  - set up helm for my app
  - upgrade my release
  - roll back my release
  - rollback helm
  - troubleshoot my release
  - why is my pod crashing
  - helm deploy
  - deploy to kubernetes
  - deploy to EKS
---

# helm-scaffold

Guided, end-to-end Helm chart scaffolding and lifecycle management for EKS.

All generators live in `__SKILL_DIR__`. Run them with:
```bash
node __SKILL_DIR__/dist/cli.bundle.js <command> [args]
```

---

## Day 1: Scaffold and Deploy

Follow these phases in order. **Present a summary after each phase and ask for confirmation before continuing.**

### Phase 0 — Collect inputs

Ask the user for:
1. **Repo path** — path to the application source (default: current working directory)
2. **App name** — used as the Helm release name prefix (e.g. `my-app`)
3. **Environments** — comma-separated list (e.g. `dev,staging,prod`); default `prod`
4. **AWS account ID** — 12-digit account number
5. **AWS region** — e.g. `us-east-1`
6. **EKS cluster name** — for the Pod Identity association command
7. **Kubecontext** — run `kubectl config get-contexts` and present the list; ask which to target
8. **HTTPS** — Ask: _"Do you want HTTPS?"_
   - If **yes**: prompt for the ACM certificate ARN. Validate it starts with `arn:aws:acm:` before accepting.
   - If **no**: show a second confirmation: _"Are you sure you want HTTP-only? This will expose the service without TLS."_ Only proceed after user confirms.

Confirm: _"Ready to scan `<repoPath>` and scaffold `<appName>` for `<environments>`. Proceed?"_

### Phase 1 — Scan

```bash
node __SKILL_DIR__/dist/cli.bundle.js scan <repoPath>
```

Output is JSON. Parse and display a summary table:
- `imageUri` (warn if null — user will need `--image` flag later)
- `containerPort` (warn if null — defaults to 3000)
- `statefulSetCandidate` — if true, ask: _"StatefulSet was detected. Use StatefulSet instead of Deployment?"_
- `awsServices` detected
- `resourceHints`

Confirm: _"Scan complete. Proceed to generate IAM policy?"_

### Phase 2 — IAM Generator

```bash
node __SKILL_DIR__/dist/cli.bundle.js generate-iam <repoPath> \
  --app <appName> \
  --env <firstEnv> \
  --cluster <clusterName> \
  --account <accountId> \
  --region <region>
```

Output is JSON `{ policyDocument, cliCommands }`. Display:
1. The policy JSON
2. The four CLI commands numbered 1–4

Tell the user: _"Run these four AWS CLI commands in order. They create the IAM policy, role, and Pod Identity association. Let me know when done."_

**Wait for user confirmation** before proceeding.

### Phase 3 — Chart Generator

```bash
OUTPUT_DIR=<repoPath>/helm/<appName>
node __SKILL_DIR__/dist/cli.bundle.js generate-chart <repoPath> "$OUTPUT_DIR" \
  --app <appName> \
  --env <firstEnv> \
  [--workload-type statefulset]   # if user confirmed StatefulSet in Phase 1
  [--image <imageUri>]            # only if scan returned null imageUri
```

Print the output directory and list of files written. Confirm: _"Chart generated. Proceed to generate values files?"_

### Phase 4 — Values Generator

```bash
node __SKILL_DIR__/dist/cli.bundle.js generate-values "$OUTPUT_DIR" \
  --repo <repoPath> \
  --app <appName> \
  --image <imageUri> \
  --port <containerPort> \
  --envs <env1,env2,...> \
  [--cert-arn <acmArn>]    # only if user chose HTTPS in Phase 0
```

Print the generated filenames. Confirm: _"Values files generated. Proceed to validate?"_

### Phase 5 — Validate

For each environment:

```bash
node __SKILL_DIR__/dist/cli.bundle.js validate \
  <appName>-<env> "$OUTPUT_DIR" <appName>-<env> <env>
```

If validation **fails**, show the error and stop — do not deploy.

If all pass, confirm: _"Validation passed for all environments. Proceed to deploy?"_

### Phase 6 — Deploy

For each environment:

```bash
helm upgrade --install <appName>-<env> "$OUTPUT_DIR" \
  -n <appName>-<env> --create-namespace \
  -f "$OUTPUT_DIR/values.yaml" \
  -f "$OUTPUT_DIR/values.<env>.yaml" \
  --kube-context <kubecontext>
```

On success print: _"✓ `<appName>-<env>` deployed successfully."_

---

## Day 2: Upgrade

1. Ask for app name, environment, kubecontext, and chart path
2. Re-run validation:
   ```bash
   node __SKILL_DIR__/dist/cli.bundle.js validate <appName>-<env> <chartPath> <appName>-<env> <env>
   ```
3. If validation passes, show diff if `helm diff` plugin available (`helm plugin list | grep diff`)
4. Run upgrade:
   ```bash
   helm upgrade <appName>-<env> <chartPath> \
     -n <appName>-<env> \
     -f <chartPath>/values.yaml -f <chartPath>/values.<env>.yaml \
     --kube-context <kubecontext>
   ```

---

## Day 2: Rollback

1. Show history: `helm history <appName>-<env> -n <appName>-<env>`
2. Ask for target revision number
3. Run: `helm rollback <appName>-<env> <revision> -n <appName>-<env>`

---

## Day 2: Troubleshoot

```bash
node __SKILL_DIR__/dist/cli.bundle.js troubleshoot <appName>-<env> <appName>-<env>
```

The command runs `helm status`, `helm history`, `kubectl describe pod`, and `kubectl logs` in sequence. It automatically adds `--previous` to the logs command if `CrashLoopBackOff` is detected in the describe output.

---

## Naming Convention

All resources use `<app>-<env>`:

| Resource | Value |
|---|---|
| Helm release | `<app>-<env>` |
| Kubernetes namespace | `<app>-<env>` |
| Service account | `<app>-<env>` |
| IAM role | `<app>-<env>` |
| IAM policy | `<app>-<env>` |

## Key Constraints

- ECR image registry only (inferred from docker-compose `image:`)
- External Secrets Operator backed by SSM Parameter Store (not Secrets Manager)
- AWS Load Balancer Controller for Ingress (not nginx)
- EKS Pod Identity trust policy (not IRSA/OIDC)
- Customer-managed IAM only — no AWS managed policies

See [REFERENCE.md](REFERENCE.md) for architecture details and generated file descriptions.
