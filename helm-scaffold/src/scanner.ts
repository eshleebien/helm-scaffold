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

const SDK_PACKAGE_TO_SERVICE: Record<string, string> = {
  's3': 's3',
  'sqs': 'sqs',
  'sns': 'sns',
  'dynamodb': 'dynamodb',
  'ssm': 'ssm',
  'secrets-manager': 'secretsmanager',
};

const BOTO3_CLIENT_RE = /boto3\.(?:client|resource)\s*\(\s*['"]([^'"]+)['"]/g;
const GO_SDK_RE = /"github\.com\/aws\/aws-sdk-go(?:-v2)?\/service\/(\w+)"/g;

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', 'vendor']);
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java']);

const ENV_PATTERN_MAP: Array<[RegExp, string]> = [
  [/BUCKET/i, 's3'],
  [/QUEUE/i, 'sqs'],
  [/TOPIC/i, 'sns'],
  [/TABLE/i, 'dynamodb'],
  [/PARAMETER/i, 'ssm'],
  [/SECRET/i, 'secretsmanager'],
];

type EnvEntry = { name: string; value?: string };

export async function scan(repoPath: string): Promise<SignalMap> {
  const signals = emptySignalMap();
  const envEntries: EnvEntry[] = [];
  await scanDockerCompose(repoPath, signals, envEntries);
  await scanDockerfile(repoPath, signals);
  await scanSdkImports(repoPath, signals);
  await scanConfigFiles(repoPath, signals, envEntries);
  applyEnvVarPatterns(signals, envEntries);
  return signals;
}

function isResourceName(value: string): boolean {
  return Boolean(value) &&
    !value.startsWith('/') &&
    !value.includes('://') &&
    !value.startsWith('$') &&
    !/\s/.test(value);
}

function applyEnvVarPatterns(signals: SignalMap, envEntries: EnvEntry[]): void {
  for (const { name, value } of envEntries) {
    for (const [pattern, service] of ENV_PATTERN_MAP) {
      if (pattern.test(name)) {
        addService(signals, service);
        if (value && isResourceName(value) && !(service in signals.resourceHints)) {
          signals.resourceHints[service] = value;
        }
      }
    }
  }
}

function addService(signals: SignalMap, service: string): void {
  if (!signals.awsServices.includes(service)) {
    signals.awsServices.push(service);
  }
}

function walkFiles(dir: string, exts: Set<string>): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...walkFiles(path.join(dir, entry.name), exts));
      }
    } else if (entry.isFile() && exts.has(path.extname(entry.name))) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

async function scanSdkImports(repoPath: string, signals: SignalMap): Promise<void> {
  const files = walkFiles(repoPath, SOURCE_EXTS);
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const nodeMatches = content.matchAll(/@aws-sdk\/client-([\w-]+)/g);
    for (const m of nodeMatches) {
      const svc = SDK_PACKAGE_TO_SERVICE[m[1]];
      if (svc) addService(signals, svc);
    }

    const boto3Matches = content.matchAll(BOTO3_CLIENT_RE);
    for (const m of boto3Matches) {
      const svc = SDK_PACKAGE_TO_SERVICE[m[1]] ?? m[1];
      addService(signals, svc);
    }

    const goMatches = content.matchAll(GO_SDK_RE);
    for (const m of goMatches) {
      const svc = SDK_PACKAGE_TO_SERVICE[m[1]] ?? m[1];
      addService(signals, svc);
    }
  }
}

async function scanDockerCompose(repoPath: string, signals: SignalMap, envEntries: EnvEntry[]): Promise<void> {
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
            const parts = String(entry).split('=');
            const varName = parts[0];
            const varValue = parts.slice(1).join('=') || undefined;
            if (varName) {
              signals.envVarNames.push(varName);
              envEntries.push({ name: varName, value: varValue });
            }
          }
        } else if (typeof environment === 'object' && environment !== null) {
          for (const [key, val] of Object.entries(environment as Record<string, unknown>)) {
            signals.envVarNames.push(key);
            envEntries.push({ name: key, value: val != null ? String(val) : undefined });
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

async function scanConfigFiles(repoPath: string, signals: SignalMap, envEntries: EnvEntry[]): Promise<void> {
  await scanDotEnvExample(repoPath, signals, envEntries);
  await scanServerlessYml(repoPath, signals, envEntries);
}

async function scanDotEnvExample(repoPath: string, signals: SignalMap, envEntries: EnvEntry[]): Promise<void> {
  const filePath = path.join(repoPath, '.env.example');
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const varName = trimmed.slice(0, eqIdx).trim();
    const varValue = trimmed.slice(eqIdx + 1).trim() || undefined;
    if (varName && !signals.envVarNames.includes(varName)) {
      signals.envVarNames.push(varName);
    }
    envEntries.push({ name: varName, value: varValue });
  }
}

async function scanServerlessYml(repoPath: string, signals: SignalMap, envEntries: EnvEntry[]): Promise<void> {
  const candidates = ['serverless.yml', 'serverless.yaml'];
  for (const name of candidates) {
    const filePath = path.join(repoPath, name);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = yaml.load(raw) as Record<string, unknown>;
    if (!doc || typeof doc !== 'object') return;

    const provider = doc['provider'] as Record<string, unknown> | undefined;
    const env = provider?.['environment'];
    if (!env || typeof env !== 'object') return;

    for (const [key, val] of Object.entries(env as Record<string, unknown>)) {
      if (!signals.envVarNames.includes(key)) {
        signals.envVarNames.push(key);
      }
      envEntries.push({ name: key, value: val != null ? String(val) : undefined });
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
