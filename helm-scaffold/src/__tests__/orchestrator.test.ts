import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { releaseNames, buildDeployCommand, buildUpgradeCommand, buildRollbackCommand, buildTroubleshootCommands, runOrchestration, OrchestrationConfig, hasCrashLoopBackOff, buildLogsArgs } from '../orchestrator';

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

describe('buildTroubleshootCommands', () => {
  it('returns an array of exactly 4 commands', () => {
    const cmds = buildTroubleshootCommands('my-app', 'prod');
    expect(cmds).toHaveLength(4);
  });

  it('commands include helm status, helm history, kubectl describe pod, kubectl logs in order', () => {
    const cmds = buildTroubleshootCommands('my-app', 'prod');
    expect(cmds[0]).toContain('helm status');
    expect(cmds[1]).toContain('helm history');
    expect(cmds[2]).toContain('kubectl describe pod');
    expect(cmds[3]).toContain('kubectl logs');
  });

  it('all commands use <app>-<env> naming and correct label selector', () => {
    const cmds = buildTroubleshootCommands('my-app', 'prod');
    for (const cmd of cmds) {
      expect(cmd).toContain('my-app-prod');
    }
    expect(cmds[2]).toContain('app.kubernetes.io/instance=my-app-prod');
    expect(cmds[3]).toContain('app.kubernetes.io/instance=my-app-prod');
  });
});

describe('hasCrashLoopBackOff', () => {
  it('returns true when describe output contains CrashLoopBackOff', () => {
    const output = 'State: Waiting\n  Reason: CrashLoopBackOff\nRestart Count: 5';
    expect(hasCrashLoopBackOff(output)).toBe(true);
  });

  it('returns false when describe output does not contain CrashLoopBackOff', () => {
    const output = 'State: Running\n  Started: Mon, 01 Jan 2024\nReady: True';
    expect(hasCrashLoopBackOff(output)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasCrashLoopBackOff('')).toBe(false);
  });
});

describe('buildLogsArgs', () => {
  it('does not include --previous when withPrevious is false', () => {
    const args = buildLogsArgs('my-app-prod', 'my-app-prod', false);
    expect(args).not.toContain('--previous');
    expect(args).toContain('--tail=100');
    expect(args).toContain('app.kubernetes.io/instance=my-app-prod');
  });

  it('includes --previous when withPrevious is true', () => {
    const args = buildLogsArgs('my-app-prod', 'my-app-prod', true);
    expect(args).toContain('--previous');
  });

  it('uses correct namespace and label selector', () => {
    const args = buildLogsArgs('my-app-prod', 'my-app-prod', false);
    expect(args).toContain('-n');
    expect(args[args.indexOf('-n') + 1]).toBe('my-app-prod');
    expect(args.some(a => a.includes('app.kubernetes.io/instance=my-app-prod'))).toBe(true);
  });
});
