import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import { generateChart, ChartConfig } from '../chartGenerator';
import { generateValues, ValuesConfig } from '../valuesGenerator';
import { SignalMap } from '../scanner';

const SCRIPT = path.resolve(__dirname, '../../scripts/validate.sh');

const signals: SignalMap = {
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
  namedVolumes: [],
  envVarNames: ['APP_ENV'],
  statefulSetCandidate: false,
  awsServices: [],
  resourceHints: {},
};

const chartConfig: ChartConfig = {
  appName: 'my-app',
  namespace: 'my-app-prod',
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
};

const valuesConfig: ValuesConfig = {
  appName: 'my-app',
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
  containerPort: 3000,
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
  generateChart(tmpDir, signals, chartConfig);
  generateValues(tmpDir, signals, valuesConfig, ['prod']);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8' });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

describe('validate.sh', () => {
  it('exits 0 and prints "Validation passed" for a valid chart (3 args)', () => {
    const { status, stdout } = run(['my-app-prod', tmpDir, 'my-app-prod']);

    expect(status).toBe(0);
    expect(stdout).toContain('Validation passed');
  });

  it('exits 0 when env arg is provided and values.<env>.yaml exists', () => {
    const { status, stdout } = run(['my-app-prod', tmpDir, 'my-app-prod', 'prod']);

    expect(status).toBe(0);
    expect(stdout).toContain('Validation passed');
  });

  it('exits non-zero with error message when chart has a lint error', () => {
    // corrupt Chart.yaml to trigger lint failure
    fs.writeFileSync(path.join(tmpDir, 'Chart.yaml'), 'not: valid: yaml: [[[', 'utf8');

    const { status, stderr, stdout } = run(['my-app-prod', tmpDir, 'my-app-prod']);
    const combined = stdout + stderr;

    expect(status).not.toBe(0);
    expect(combined.toLowerCase()).toMatch(/error|fail/);
  });

  it('script is executable', () => {
    const stat = fs.statSync(SCRIPT);
    // check owner execute bit
    expect(stat.mode & 0o100).toBeTruthy();
  });
});
