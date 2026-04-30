import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { generateValues, ValuesConfig } from '../valuesGenerator';
import { SignalMap } from '../scanner';

const baseSignals: SignalMap = {
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
  namedVolumes: [],
  envVarNames: ['DATABASE_URL', 'APP_ENV'],
  statefulSetCandidate: false,
  awsServices: ['s3'],
  resourceHints: {},
};

const baseConfig: ValuesConfig = {
  appName: 'my-app',
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'values-gen-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function loadYaml(file: string): Record<string, unknown> {
  return yaml.load(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

describe('generateValues', () => {
  it('values.yaml contains all required top-level keys', () => {
    generateValues(tmpDir, baseSignals, baseConfig, []);

    const values = loadYaml(path.join(tmpDir, 'values.yaml'));
    for (const key of ['image', 'resources', 'livenessProbe', 'readinessProbe', 'hpa', 'ingress', 'serviceAccount', 'externalSecret']) {
      expect(values).toHaveProperty(key);
    }
  });

  it('values.yaml resource defaults are non-zero', () => {
    generateValues(tmpDir, baseSignals, baseConfig, []);

    const values = loadYaml(path.join(tmpDir, 'values.yaml'));
    const res = values['resources'] as Record<string, Record<string, string>>;

    expect(res.requests.cpu).toBeTruthy();
    expect(res.requests.memory).toBeTruthy();
    expect(res.limits.cpu).toBeTruthy();
    expect(res.limits.memory).toBeTruthy();
  });

  it('only generates per-env files for requested environments', () => {
    generateValues(tmpDir, baseSignals, baseConfig, ['dev', 'prod']);

    expect(fs.existsSync(path.join(tmpDir, 'values.dev.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'values.prod.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'values.staging.yaml'))).toBe(false);
  });

  it('HPA min/max defaults match dev 1-2, staging 2-4, prod 3-10', () => {
    generateValues(tmpDir, baseSignals, baseConfig, ['dev', 'staging', 'prod']);

    const cases: Array<[string, number, number]> = [
      ['dev',     1, 2],
      ['staging', 2, 4],
      ['prod',    3, 10],
    ];
    for (const [env, min, max] of cases) {
      const v = loadYaml(path.join(tmpDir, `values.${env}.yaml`));
      const hpa = v['hpa'] as Record<string, number>;
      expect(hpa.minReplicas).toBe(min);
      expect(hpa.maxReplicas).toBe(max);
    }
  });

  it('per-env ingress hostname uses <app>.<env>.example.com pattern', () => {
    generateValues(tmpDir, baseSignals, baseConfig, ['dev', 'prod']);

    const dev  = loadYaml(path.join(tmpDir, 'values.dev.yaml'));
    const prod = loadYaml(path.join(tmpDir, 'values.prod.yaml'));

    expect((dev['ingress'] as Record<string,string>).host).toBe('my-app.dev.example.com');
    expect((prod['ingress'] as Record<string,string>).host).toBe('my-app.prod.example.com');
  });

  it('merging base + env values produces a complete set with all required keys', () => {
    generateValues(tmpDir, baseSignals, baseConfig, ['prod']);

    const base = loadYaml(path.join(tmpDir, 'values.yaml'));
    const env  = loadYaml(path.join(tmpDir, 'values.prod.yaml'));

    // shallow merge: env overrides win, base fills the rest
    const merged = { ...base, ...env } as Record<string, unknown>;

    for (const key of ['image', 'resources', 'livenessProbe', 'readinessProbe', 'hpa', 'ingress', 'serviceAccount', 'externalSecret']) {
      expect(merged).toHaveProperty(key);
    }

    // env-specific overrides applied
    const hpa = merged['hpa'] as Record<string, number>;
    expect(hpa.minReplicas).toBe(3);
    expect(hpa.maxReplicas).toBe(10);
  });

  it('values.yaml sets CPU target to 70%', () => {
    generateValues(tmpDir, baseSignals, baseConfig, []);

    const values = loadYaml(path.join(tmpDir, 'values.yaml'));
    const hpa = values['hpa'] as Record<string, number>;

    expect(hpa.cpuTargetPercent).toBe(70);
  });
});
