# helm-scaffold: Scanner — AWS service detection

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/3
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Extend the Scanner with AWS service detection across three signal sources: SDK import scanning (boto3, @aws-sdk/\*, aws-sdk for Go/Java), environment variable pattern matching (\_BUCKET\_ → S3, \_QUEUE\_ → SQS, \_TABLE\_ → DynamoDB, \_PARAMETER\_ / \_SECRET\_ → SSM, etc.), and config file parsing (.env.example, serverless.yml). The Scanner merges signals from all three sources into the SignalMap, including inferred resource name hints where env var values reveal them. Include tests.

## Acceptance criteria

- [ ] Scanner detects AWS SDK imports for Python (boto3), Node.js (@aws-sdk/\*), and Go (aws-sdk-go) correctly
- [ ] Scanner maps env var name patterns to AWS services (at minimum: S3, SQS, SNS, DynamoDB, SSM, Secrets Manager)
- [ ] Scanner extracts resource name hints from env var values (e.g. a bucket name literal) and adds them to SignalMap
- [ ] Scanner parses .env.example and serverless.yml for additional AWS service signals
- [ ] All three signal sources are merged; a service detected by any source appears in SignalMap
- [ ] Tests pass using fixture source files with known imports, env vars, and config files

## Blocked by

- [#2 — skill scaffold + Scanner (docker-compose & Dockerfile)](https://github.com/eshleebien/miniature-octo-invention/issues/2)
