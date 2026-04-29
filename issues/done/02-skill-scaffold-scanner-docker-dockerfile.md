# helm-scaffold: skill scaffold + Scanner (docker-compose & Dockerfile)

> GitHub: https://github.com/eshleebien/miniature-octo-invention/issues/2
> Labels: needs-triage, enhancement

## Parent

[#1 — helm-scaffold: AI-guided Helm chart scaffolding and lifecycle management for EKS](https://github.com/eshleebien/miniature-octo-invention/issues/1)

## What to build

Set up the `helm-scaffold` skill directory structure (SKILL.md, REFERENCE.md, scripts/) and implement the core Scanner module. The Scanner parses docker-compose files (image URI, exposed ports, named volumes, environment variables) and Dockerfiles (EXPOSE directives) and outputs a typed SignalMap used by all downstream generators. Include tests that assert the correct SignalMap is produced from fixture repos.

## Acceptance criteria

- [ ] `helm-scaffold` skill directory exists with SKILL.md and correct frontmatter description and triggers
- [ ] Scanner correctly infers ECR image URI from docker-compose `image:` field
- [ ] Scanner correctly infers container port from docker-compose `ports:` and Dockerfile `EXPOSE`
- [ ] Scanner detects named volumes in docker-compose and includes them in SignalMap
- [ ] Scanner captures environment variable names from docker-compose `environment:` block
- [ ] SignalMap is a well-defined structured output consumed by all downstream generators
- [ ] Tests pass for all scanner behaviours using fixture docker-compose and Dockerfile inputs

## Blocked by

None — can start immediately
