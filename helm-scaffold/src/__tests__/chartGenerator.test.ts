import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
import { generateChart, ChartConfig } from '../chartGenerator';
import { SignalMap } from '../scanner';

const baseSignals: SignalMap = {
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
  namedVolumes: [],
  envVarNames: ['DATABASE_URL', 'APP_ENV'],
  statefulSetCandidate: false,
  awsServices: ['s3', 'ssm'],
  resourceHints: { s3: 'my-app-uploads' },
};

const baseConfig: ChartConfig = {
  appName: 'my-app',
  namespace: 'my-app-prod',
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-scaffold-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('generateChart', () => {
  it('creates Chart.yaml with correct apiVersion, name, and version', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const chartYaml = yaml.load(
      fs.readFileSync(path.join(tmpDir, 'Chart.yaml'), 'utf8')
    ) as Record<string, unknown>;

    expect(chartYaml['apiVersion']).toBe('v2');
    expect(chartYaml['name']).toBe('my-app');
    expect(chartYaml['version']).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('values.yaml has image repository and tag derived from imageUri', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const values = yaml.load(
      fs.readFileSync(path.join(tmpDir, 'values.yaml'), 'utf8')
    ) as Record<string, unknown>;
    const image = values['image'] as Record<string, string>;

    expect(image['repository']).toBe('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app');
    expect(image['tag']).toBe('latest');
  });

  it('deployment.yaml references image from values and sets the container port', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'deployment.yaml'), 'utf8');
    expect(raw).toContain('.Values.image.repository');
    expect(raw).toContain('3000');
  });

  it('deployment.yaml includes env var names from SignalMap.envVarNames', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'deployment.yaml'), 'utf8');
    expect(raw).toContain('DATABASE_URL');
    expect(raw).toContain('APP_ENV');
  });

  it('deployment.yaml references resource limits and liveness/readiness probes from values', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'deployment.yaml'), 'utf8');
    expect(raw).toContain('.Values.resources');
    expect(raw).toContain('.Values.livenessProbe');
    expect(raw).toContain('.Values.readinessProbe');
  });

  it('helm lint passes on the generated chart', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`helm lint ${tmpDir}`, { encoding: 'utf8' });
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; status?: number };
      output = (execErr.stdout ?? '') + (execErr.stderr ?? '');
      exitCode = execErr.status ?? 1;
    }

    expect(exitCode).toBe(0);
    expect(output).toContain('1 chart(s) linted');
    expect(output).not.toContain('[ERROR]');
  });

  it('externalsecret.yaml references SSM Parameter Store via ESO', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'externalsecret.yaml'), 'utf8');
    expect(raw).toContain('external-secrets.io');
    expect(raw).toContain('ClusterSecretStore');
    expect(raw).toContain('.Values.externalSecret.secretStoreName');
  });

  it('hpa.yaml targets CPU at 70% with min/max replicas from config', () => {
    const config = { ...baseConfig, minReplicas: 2, maxReplicas: 5 };
    generateChart(tmpDir, baseSignals, config);

    const values = yaml.load(
      fs.readFileSync(path.join(tmpDir, 'values.yaml'), 'utf8')
    ) as Record<string, unknown>;
    const hpa = values['hpa'] as Record<string, number>;

    expect(hpa['cpuTargetPercent']).toBe(70);
    expect(hpa['minReplicas']).toBe(2);
    expect(hpa['maxReplicas']).toBe(5);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'hpa.yaml'), 'utf8');
    expect(raw).toContain('.Values.hpa.cpuTargetPercent');
    expect(raw).toContain('.Values.hpa.minReplicas');
    expect(raw).toContain('.Values.hpa.maxReplicas');
  });

  it('serviceaccount.yaml includes Pod Identity annotation', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'serviceaccount.yaml'), 'utf8');
    expect(raw).toContain('eks.amazonaws.com/pod-identity-association');
  });

  it('ingress.yaml includes AWS Load Balancer Controller annotations', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'ingress.yaml'), 'utf8');
    expect(raw).toContain('kubernetes.io/ingress.class: alb');
    expect(raw).toContain('alb.ingress.kubernetes.io/scheme: internet-facing');
  });

  it('service.yaml targets the container port', () => {
    generateChart(tmpDir, baseSignals, baseConfig);

    const raw = fs.readFileSync(path.join(tmpDir, 'templates', 'service.yaml'), 'utf8');
    expect(raw).toContain('3000');
    expect(raw).toContain('.Values.service.port');
  });
});
