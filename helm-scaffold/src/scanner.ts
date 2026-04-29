import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface SignalMap {
  imageUri: string | null;
  containerPort: number | null;
  namedVolumes: string[];
  envVarNames: string[];
  statefulSetCandidate: boolean;
  awsServices: string[];
  resourceHints: Record<string, string>;
}

function emptySignalMap(): SignalMap {
  return {
    imageUri: null,
    containerPort: null,
    namedVolumes: [],
    envVarNames: [],
    statefulSetCandidate: false,
    awsServices: [],
    resourceHints: {},
  };
}

export async function scan(repoPath: string): Promise<SignalMap> {
  const signals = emptySignalMap();
  await scanDockerCompose(repoPath, signals);
  await scanDockerfile(repoPath, signals);
  return signals;
}

async function scanDockerCompose(repoPath: string, signals: SignalMap): Promise<void> {
  const candidates = ['docker-compose.yml', 'docker-compose.yaml'];
  for (const name of candidates) {
    const filePath = path.join(repoPath, name);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = yaml.load(raw) as Record<string, unknown>;
    if (!doc || typeof doc !== 'object') return;

    const services = doc['services'] as Record<string, unknown> | undefined;
    if (!services) return;

    for (const service of Object.values(services)) {
      const svc = service as Record<string, unknown>;

      if (signals.imageUri === null && svc['image']) {
        signals.imageUri = String(svc['image']);
      }

      if (signals.containerPort === null && Array.isArray(svc['ports'])) {
        for (const port of svc['ports']) {
          const portStr = String(port);
          const match = portStr.match(/:?(\d+)$/);
          if (match) {
            signals.containerPort = parseInt(match[1], 10);
            break;
          }
        }
      }

      const environment = svc['environment'];
      if (environment) {
        if (Array.isArray(environment)) {
          for (const entry of environment) {
            const name = String(entry).split('=')[0];
            if (name) signals.envVarNames.push(name);
          }
        } else if (typeof environment === 'object' && environment !== null) {
          for (const key of Object.keys(environment as object)) {
            signals.envVarNames.push(key);
          }
        }
      }
    }

    const topLevelVolumes = doc['volumes'];
    if (topLevelVolumes && typeof topLevelVolumes === 'object') {
      for (const vol of Object.keys(topLevelVolumes as object)) {
        if (!signals.namedVolumes.includes(vol)) {
          signals.namedVolumes.push(vol);
        }
      }
    }

    return;
  }
}

async function scanDockerfile(repoPath: string, signals: SignalMap): Promise<void> {
  if (signals.containerPort !== null) return;

  const filePath = path.join(repoPath, 'Dockerfile');
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^EXPOSE\s+(\d+)/i);
    if (match) {
      signals.containerPort = parseInt(match[1], 10);
      return;
    }
  }
}
