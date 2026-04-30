import * as path from 'path';
import { execFileSync } from 'child_process';
import { scan, SignalMap } from './scanner';
import { generateChart, ChartConfig } from './chartGenerator';
import { generateValues, ValuesConfig } from './valuesGenerator';
import { generateIam, IamConfig, IamOutput } from './iamGenerator';

export interface ReleaseNames {
  release: string;
  namespace: string;
  serviceAccount: string;
}

export function releaseNames(appName: string, env: string): ReleaseNames {
  const name = `${appName}-${env}`;
  return { release: name, namespace: name, serviceAccount: name };
}

export function buildDeployCommand(appName: string, env: string, chartPath: string): string {
  const { release, namespace } = releaseNames(appName, env);
  return [
    'helm upgrade --install',
    release,
    chartPath,
    `-n ${namespace}`,
    '--create-namespace',
    `-f ${chartPath}/values.yaml`,
    `-f ${chartPath}/values.${env}.yaml`,
  ].join(' ');
}

export function buildUpgradeCommand(appName: string, env: string, chartPath: string, kubecontext: string): string {
  const { release, namespace } = releaseNames(appName, env);
  return [
    'helm upgrade',
    release,
    chartPath,
    `-n ${namespace}`,
    `-f values.yaml`,
    `-f values.${env}.yaml`,
    `--kube-context ${kubecontext}`,
  ].join(' ');
}

export function buildRollbackCommand(appName: string, env: string, revision: number): string {
  const { release, namespace } = releaseNames(appName, env);
  return `helm rollback ${release} ${revision} -n ${namespace}`;
}

export function buildTroubleshootCommands(appName: string, env: string): string[] {
  const { release, namespace } = releaseNames(appName, env);
  const selector = `app.kubernetes.io/instance=${release}`;
  return [
    `helm status ${release} -n ${namespace}`,
    `helm history ${release} -n ${namespace}`,
    `kubectl describe pod -l ${selector} -n ${namespace}`,
    `kubectl logs -l ${selector} -n ${namespace} --tail=100`,
  ];
}

export interface OrchestrationConfig {
  repoPath: string;
  appName: string;
  environments: string[];
  outputDir: string;
  iamConfig: IamConfig;
}

export interface OrchestrationResult {
  signals: SignalMap;
  iamOutput: IamOutput;
  deployCommands: string[];
}

export async function runOrchestration(config: OrchestrationConfig): Promise<OrchestrationResult> {
  const { repoPath, appName, environments, outputDir, iamConfig } = config;

  const signals = await scan(repoPath);

  const imageUri = signals.imageUri ?? 'REPLACE_WITH_ECR_URI:latest';
  const containerPort = signals.containerPort ?? 3000;

  const chartConfig: ChartConfig = { appName, namespace: `${appName}-${environments[0] ?? 'prod'}`, imageUri, containerPort };
  const valuesConfig: ValuesConfig = { appName, imageUri, containerPort };

  generateChart(outputDir, signals, chartConfig);
  generateValues(outputDir, signals, valuesConfig, environments);

  const iamOutput = generateIam(signals, iamConfig);

  const deployCommands = environments.map(env => buildDeployCommand(appName, env, outputDir));

  return { signals, iamOutput, deployCommands };
}

export function runValidation(chartPath: string, release: string, namespace: string, env: string): void {
  const script = path.resolve(__dirname, '../../scripts/validate.sh');
  execFileSync('bash', [script, release, chartPath, namespace, env], { stdio: 'inherit' });
}
