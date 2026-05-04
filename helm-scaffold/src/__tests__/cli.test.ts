import { spawnSync } from 'child_process';
import * as path from 'path';

const CLI = path.resolve(__dirname, '../../src/cli.ts');
const TS_NODE = path.resolve(__dirname, '../../node_modules/.bin/ts-node');

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(TS_NODE, [CLI, ...args], { encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr ?? '', stdout: result.stdout ?? '' };
}

describe('generate-values --cert-arn validation', () => {
  it('exits non-zero and prints an error when cert-arn does not start with arn:aws:acm:', () => {
    const result = runCli([
      'generate-values', '/tmp',
      '--app', 'my-app',
      '--image', '123.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
      '--port', '3000',
      '--envs', 'prod',
      '--cert-arn', 'not-a-valid-arn',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('arn:aws:acm:');
  });

  it('accepts a valid arn:aws:acm: cert ARN without error', () => {
    const result = runCli([
      'generate-values', '/tmp',
      '--app', 'my-app',
      '--image', '123.dkr.ecr.us-east-1.amazonaws.com/my-app:latest',
      '--port', '3000',
      '--envs', 'prod',
      '--cert-arn', 'arn:aws:acm:us-east-1:123456789012:certificate/abc-123',
    ]);
    expect(result.status).toBe(0);
  });
});
