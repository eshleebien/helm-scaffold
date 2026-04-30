import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { releaseNames, buildDeployCommand, buildUpgradeCommand, buildRollbackCommand, runOrchestration, OrchestrationConfig } from '../orchestrator';

const FIXTURES = path.join(__dirname, 'fixtures');

let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-test-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('releaseNames', () => {
  it('returns <app>-<env> for release, namespace, and serviceAccount', () => {
    const names = releaseNames('my-app', 'prod');
    expect(names.release).toBe('my-app-prod');
    expect(names.namespace).toBe('my-app-prod');
    expect(names.serviceAccount).toBe('my-app-prod');
  });
});

describe('runOrchestration', () => {
  it('scans repo, generates chart + values + IAM, and returns deploy commands per env', async () => {
    const config: OrchestrationConfig = {
      repoPath: path.join(FIXTURES, 'simple'),
      appName: 'my-app',
      environments: ['dev', 'prod'],
      outputDir: tmpDir,
      iamConfig: {
        appName: 'my-app',
        environment: 'prod',
        clusterName: 'my-cluster',
        accountId: '123456789012',
        region: 'us-east-1',
      },
    };

    const result = await runOrchestration(config);

    // scanner ran
    expect(result.signals.containerPort).toBe(3000);

    // chart generated
    const { existsSync } = await import('fs');
    expect(existsSync(path.join(tmpDir, 'Chart.yaml'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'values.dev.yaml'))).toBe(true);
    expect(existsSync(path.join(tmpDir, 'values.prod.yaml'))).toBe(true);

    // IAM produced
    expect(result.iamOutput.policyDocument.Statement).toBeDefined();
    expect(result.iamOutput.cliCommands).toHaveLength(4);

    // one deploy command per env
    expect(result.deployCommands).toHaveLength(2);
    expect(result.deployCommands[0]).toContain('my-app-dev');
    expect(result.deployCommands[1]).toContain('my-app-prod');
  });
});

describe('buildDeployCommand', () => {
  it('produces helm upgrade --install with correct release, namespace, and values flags', () => {
    const cmd = buildDeployCommand('my-app', 'prod', '/charts/my-app');

    expect(cmd).toContain('helm upgrade --install');
    expect(cmd).toContain('my-app-prod');
    expect(cmd).toContain('-n my-app-prod');
    expect(cmd).toContain('--create-namespace');
    expect(cmd).toContain('-f /charts/my-app/values.yaml');
    expect(cmd).toContain('-f /charts/my-app/values.prod.yaml');
  });
});

describe('buildUpgradeCommand', () => {
  it('produces helm upgrade (no --install) with correct release, namespace, values flags, and kubecontext', () => {
    const cmd = buildUpgradeCommand('my-app', 'prod', '/charts/my-app', 'arn:aws:eks:us-east-1:123:cluster/my-cluster');

    expect(cmd).toContain('helm upgrade');
    expect(cmd).not.toContain('--install');
    expect(cmd).toContain('my-app-prod');
    expect(cmd).toContain('-n my-app-prod');
    expect(cmd).toContain('-f values.yaml');
    expect(cmd).toContain('-f values.prod.yaml');
    expect(cmd).toContain('--kube-context arn:aws:eks:us-east-1:123:cluster/my-cluster');
  });
});

describe('buildRollbackCommand', () => {
  it('produces helm rollback with correct release, revision, and namespace', () => {
    const cmd = buildRollbackCommand('my-app', 'prod', 3);

    expect(cmd).toContain('helm rollback');
    expect(cmd).toContain('my-app-prod');
    expect(cmd).toContain('3');
    expect(cmd).toContain('-n my-app-prod');
  });
});
