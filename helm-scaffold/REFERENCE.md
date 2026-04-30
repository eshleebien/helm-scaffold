# helm-scaffold Reference

## Architecture

```
scan(repoPath) → SignalMap
                    ↓
        ┌───────────┼────────────┐
   IAMGenerator  ChartGenerator  ValuesGenerator
        ↓              ↓               ↓
   IAMCommands    ChartFiles      ValuesFiles
        └───────────┼────────────┘
                    ↓
              Validator (helm lint + dry-run)
                    ↓
              helm upgrade --install
```

## SignalMap

The central data structure produced by the Scanner and consumed by all generators:

```typescript
interface SignalMap {
  imageUri: string | null;              // ECR image URI from docker-compose image:
  containerPort: number | null;         // Port from docker-compose ports: or Dockerfile EXPOSE
  namedVolumes: string[];               // Named volumes from docker-compose top-level volumes:
  envVarNames: string[];                // Env var names from docker-compose environment:
  statefulSetCandidate: boolean;        // True if any StatefulSet signal fires
  awsServices: string[];                // Detected AWS services (s3, sqs, sns, dynamodb, ssm, ...)
  resourceHints: Record<string, string>; // Inferred resource names (e.g. bucket name from env value)
}
```

## Scanner Signal Sources

| Source | Signals extracted |
|--------|------------------|
| `docker-compose.yml` | `imageUri`, `containerPort`, `namedVolumes`, `envVarNames` |
| `Dockerfile` | `containerPort` (EXPOSE, fallback only) |
| SDK imports | `awsServices` (boto3 → s3/etc, @aws-sdk/*, aws-sdk-go) |
| Env var patterns | `awsServices`, `resourceHints` (_BUCKET_ → s3, _QUEUE_ → sqs, ...) |
| `.env.example` | `awsServices`, `resourceHints` |
| `serverless.yml` | `awsServices`, `resourceHints` |
| Existing PVC manifests | `statefulSetCandidate: true` |

## StatefulSet Detection

`statefulSetCandidate` is set to `true` when any of:
- Named volumes present in docker-compose `volumes:` block
- Env vars match database-adjacent patterns: `POSTGRES_*`, `DATABASE_URL`, `MYSQL_*`, `REDIS_URL`
- Any `PersistentVolumeClaim` manifest exists anywhere in the repo

## Generated Chart Files

| File | Purpose |
|------|---------|
| `Chart.yaml` | Chart metadata |
| `templates/deployment.yaml` | Deployment with resources, probes, env from SignalMap |
| `templates/statefulset.yaml` | StatefulSet variant (replaces deployment.yaml) |
| `templates/service.yaml` | ClusterIP service on containerPort |
| `templates/ingress.yaml` | ALB ingress with AWS Load Balancer Controller annotations |
| `templates/serviceaccount.yaml` | SA with Pod Identity annotation, named `<app>-<env>` |
| `templates/hpa.yaml` | CPU-based HPA at 70% target (omitted for StatefulSet) |
| `templates/externalsecret.yaml` | ESO ExternalSecret backed by SSM Parameter Store |
| `templates/_helpers.tpl` | Shared label/name helpers |

## Values Structure

```yaml
# values.yaml (base)
image:
  repository: <ECR URI>
  tag: latest
resources:
  requests: { cpu: 100m, memory: 128Mi }
  limits:   { cpu: 500m, memory: 512Mi }
probes:
  liveness:  { path: /healthz, port: <containerPort> }
  readiness: { path: /ready,   port: <containerPort> }
hpa:
  minReplicas: 1
  maxReplicas: 2
  cpuTargetUtilization: 70
ingress:
  host: <app>.example.com
  certificateArn: ""
serviceAccount:
  name: <app>-<env>
externalSecret:
  refreshInterval: 1h
  store: aws-ssm
```

Per-env files override only: `replicaCount`, `resources`, `hpa.minReplicas`, `hpa.maxReplicas`, `ingress.host`.

## HPA Defaults by Environment

| Environment | minReplicas | maxReplicas |
|-------------|-------------|-------------|
| dev         | 1           | 2           |
| staging     | 2           | 4           |
| prod        | 3           | 10          |

## IAM: EKS Pod Identity Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "pods.eks.amazonaws.com" },
    "Action": ["sts:AssumeRole", "sts:TagSession"]
  }]
}
```

Note: This is the Pod Identity form, **not** the OIDC/IRSA form.

## AWS Service → IAM Actions Mapping

| Service   | Actions |
|-----------|---------|
| S3        | `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` |
| SQS       | `sqs:SendMessage`, `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` |
| SNS       | `sns:Publish` |
| DynamoDB  | `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:Query`, `dynamodb:Scan` |
| SSM       | `ssm:GetParameter`, `ssm:GetParametersByPath` |
| Secrets Manager | `secretsmanager:GetSecretValue` |

## Naming Convention

All resources: `<app>-<env>`

- Helm release: `<app>-<env>`
- Kubernetes namespace: `<app>-<env>`
- Service account: `<app>-<env>`

## Deploy Command

```bash
helm upgrade --install <app>-<env> <chart-path> \
  -n <app>-<env> \
  --create-namespace \
  -f values.yaml \
  -f values.<env>.yaml
```
