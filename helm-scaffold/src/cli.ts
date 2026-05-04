#!/usr/bin/env ts-node
/**
 * CLI entry point for helm-scaffold generators.
 * Used by SKILL.md to run each phase of the session.
 *
 * Usage (from skill or project root):
 *   npx ts-node src/cli.ts scan <repoPath>
 *   npx ts-node src/cli.ts generate-chart <repoPath> <outputDir> --app <name> [--workload-type statefulset]
 *   npx ts-node src/cli.ts generate-values <outputDir> --app <name> --image <uri> --port <n> --envs dev,prod [--cert-arn <arn>]
 *   npx ts-node src/cli.ts generate-iam <repoPath> --app <name> --env <env> --cluster <name> --account <id> --region <region>
 *   npx ts-node src/cli.ts validate <release> <chartPath> <namespace> [env]
 */

import * as path from 'path';
import { execFileSync } from 'child_process';
import { scan } from './scanner';
import { generateChart, ChartConfig } from './chartGenerator';
import { generateValues, ValuesConfig } from './valuesGenerator';
import { generateIam, IamConfig } from './iamGenerator';
import { hasCrashLoopBackOff, buildLogsArgs } from './orchestrator';

const [,, command, ...rest] = process.argv;

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      flags[argv[i].slice(2)] = argv[i + 1] ?? 'true';
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  return { positional, flags };
}

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { positional, flags } = parseFlags(rest);

  switch (command) {

    case 'scan': {
      const repoPath = positional[0] ?? die('Usage: scan <repoPath>');
      const signals = await scan(path.resolve(repoPath));
      console.log(JSON.stringify(signals, null, 2));
      break;
    }

    case 'generate-chart': {
      const [repoPath, outputDir] = positional;
      if (!repoPath || !outputDir) die('Usage: generate-chart <repoPath> <outputDir> --app <name> [--workload-type statefulset]');

      const signals = await scan(path.resolve(repoPath));
      const appName  = flags['app'] ?? die('--app is required');
      const env      = flags['env'] ?? 'prod';
      const imageUri = signals.imageUri ?? flags['image'] ?? die('--image required (no image found in docker-compose)');
      const port     = signals.containerPort ?? parseInt(flags['port'] ?? '3000', 10);

      const config: ChartConfig = {
        appName,
        namespace:    `${appName}-${env}`,
        imageUri,
        containerPort: port,
        workloadType:  flags['workload-type'] === 'statefulset' ? 'statefulset' : 'deployment',
        storageSize:   flags['storage-size'],
        storageClass:  flags['storage-class'],
      };
      generateChart(path.resolve(outputDir), signals, config);
      console.log(`chart generated → ${path.resolve(outputDir)}`);
      break;
    }

    case 'generate-values': {
      const [outputDir] = positional;
      if (!outputDir) die('Usage: generate-values <outputDir> --app <name> --image <uri> --port <n> --envs dev,prod');

      const appName = flags['app']   ?? die('--app is required');
      const imageUri = flags['image'] ?? die('--image is required');
      const port     = parseInt(flags['port'] ?? '3000', 10);
      const envs     = (flags['envs'] ?? 'prod').split(',').map(e => e.trim());
      const certArn  = flags['cert-arn'];
      if (certArn !== undefined && !certArn.startsWith('arn:aws:acm:')) {
        die(`--cert-arn must start with 'arn:aws:acm:' (got: ${certArn})`);
      }

      // scan for awsServices / resourceHints (best-effort; values gen doesn't need signals deeply)
      const repoPath = flags['repo'] ?? '.';
      const signals  = await scan(path.resolve(repoPath));

      const config: ValuesConfig = { appName, imageUri, containerPort: port, certificateArn: certArn };
      generateValues(path.resolve(outputDir), signals, config, envs);
      console.log(`values files generated → ${path.resolve(outputDir)}`);
      for (const env of envs) console.log(`  values.${env}.yaml`);
      break;
    }

    case 'generate-iam': {
      const repoPath = positional[0] ?? flags['repo'] ?? die('Usage: generate-iam <repoPath> --app <name> --env <env> --cluster <name> --account <id> --region <region>');

      const signals = await scan(path.resolve(repoPath));
      const config: IamConfig = {
        appName:     flags['app']     ?? die('--app is required'),
        environment: flags['env']     ?? die('--env is required'),
        clusterName: flags['cluster'] ?? die('--cluster is required'),
        accountId:   flags['account'] ?? die('--account is required'),
        region:      flags['region']  ?? die('--region is required'),
      };
      const output = generateIam(signals, config);
      console.log(JSON.stringify(output, null, 2));
      break;
    }

    case 'validate': {
      const [release, chartPath, namespace, env] = positional;
      if (!release || !chartPath || !namespace) die('Usage: validate <release> <chartPath> <namespace> [env]');
      const script = path.resolve(__dirname, '..', 'scripts', 'validate.sh');
      const args = env ? [release, chartPath, namespace, env] : [release, chartPath, namespace];
      execFileSync('bash', [script, ...args], { stdio: 'inherit' });
      break;
    }

    case 'troubleshoot': {
      const [release, namespace] = positional;
      if (!release || !namespace) die('Usage: troubleshoot <release> <namespace>');

      const selector = `app.kubernetes.io/instance=${release}`;

      execFileSync('helm', ['status', release, '-n', namespace], { stdio: 'inherit' });
      execFileSync('helm', ['history', release, '-n', namespace], { stdio: 'inherit' });

      let describeOutput = '';
      try {
        describeOutput = execFileSync('kubectl', ['describe', 'pod', '-l', selector, '-n', namespace]).toString();
      } catch { /* kubectl unavailable or no pods — continue */ }
      process.stdout.write(describeOutput);

      execFileSync('kubectl', buildLogsArgs(release, namespace, hasCrashLoopBackOff(describeOutput)), { stdio: 'inherit' });
      break;
    }

    default:
      console.error(`unknown command: ${command ?? '(none)'}`);
      console.error('commands: scan | generate-chart | generate-values | generate-iam | validate | troubleshoot');
      process.exit(1);
  }
}

main().catch(err => { console.error(err.message ?? err); process.exit(1); });
