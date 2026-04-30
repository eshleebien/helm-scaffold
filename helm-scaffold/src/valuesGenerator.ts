import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SignalMap } from './scanner';

export interface ValuesConfig {
  appName: string;
  imageUri: string;
  containerPort: number;
}

interface HpaDefaults { minReplicas: number; maxReplicas: number }

const ENV_HPA: Record<string, HpaDefaults> = {
  dev:     { minReplicas: 1, maxReplicas: 2 },
  staging: { minReplicas: 2, maxReplicas: 4 },
  prod:    { minReplicas: 3, maxReplicas: 10 },
};

const ENV_RESOURCES: Record<string, object> = {
  dev: {
    requests: { cpu: '100m',  memory: '128Mi' },
    limits:   { cpu: '250m',  memory: '256Mi' },
  },
  staging: {
    requests: { cpu: '250m',  memory: '256Mi' },
    limits:   { cpu: '500m',  memory: '512Mi' },
  },
  prod: {
    requests: { cpu: '500m',  memory: '512Mi' },
    limits:   { cpu: '1000m', memory: '1Gi'   },
  },
};

function parseImageRepo(imageUri: string): string {
  const colonIdx = imageUri.lastIndexOf(':');
  if (colonIdx === -1 || imageUri.lastIndexOf('/') > colonIdx) return imageUri;
  return imageUri.slice(0, colonIdx);
}

function parseImageTag(imageUri: string): string {
  const colonIdx = imageUri.lastIndexOf(':');
  if (colonIdx === -1 || imageUri.lastIndexOf('/') > colonIdx) return 'latest';
  return imageUri.slice(colonIdx + 1);
}

function baseValues(signals: SignalMap, config: ValuesConfig): object {
  const repo = parseImageRepo(config.imageUri);
  const tag  = parseImageTag(config.imageUri);

  return {
    image: {
      repository: repo,
      tag,
      pullPolicy: 'IfNotPresent',
    },
    replicaCount: 1,
    resources: {
      requests: { cpu: '100m',  memory: '128Mi' },
      limits:   { cpu: '500m',  memory: '512Mi' },
    },
    livenessProbe: {
      httpGet: { path: '/healthz', port: config.containerPort },
      initialDelaySeconds: 10,
      periodSeconds: 10,
    },
    readinessProbe: {
      httpGet: { path: '/ready', port: config.containerPort },
      initialDelaySeconds: 5,
      periodSeconds: 5,
    },
    service: { port: config.containerPort },
    ingress: {
      enabled: true,
      host: `${config.appName}.example.com`,
      certificateArn: '',
    },
    serviceAccount: { name: '' },
    hpa: { minReplicas: 1, maxReplicas: 3, cpuTargetPercent: 70 },
    externalSecret: { enabled: true, secretStoreName: 'aws-parameter-store' },
  };
}

function envOverrides(appName: string, env: string): object {
  const hpa = ENV_HPA[env] ?? { minReplicas: 1, maxReplicas: 3 };
  const resources = ENV_RESOURCES[env] ?? ENV_RESOURCES['dev'];
  return {
    replicaCount: hpa.minReplicas,
    resources,
    hpa: { ...hpa, cpuTargetPercent: 70 },
    ingress: { host: `${appName}.${env}.example.com` },
  };
}

export function generateValues(
  outputDir: string,
  signals: SignalMap,
  config: ValuesConfig,
  environments: string[],
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const base = baseValues(signals, config);
  fs.writeFileSync(path.join(outputDir, 'values.yaml'), yaml.dump(base), 'utf8');

  for (const env of environments) {
    const overrides = envOverrides(config.appName, env);
    fs.writeFileSync(
      path.join(outputDir, `values.${env}.yaml`),
      yaml.dump(overrides),
      'utf8',
    );
  }
}
