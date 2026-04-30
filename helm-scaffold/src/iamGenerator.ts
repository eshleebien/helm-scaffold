import { SignalMap } from './scanner';

export interface IamConfig {
  appName: string;
  environment: string;
  clusterName: string;
  accountId: string;
  region: string;
}

export interface PolicyStatement {
  Effect: 'Allow';
  Action: string[];
  Resource: string | string[];
}

export interface PolicyDocument {
  Version: string;
  Statement: PolicyStatement[];
}

export interface IamOutput {
  policyDocument: PolicyDocument;
  cliCommands: string[];
}

const SERVICE_ACTIONS: Record<string, string[]> = {
  s3: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
  sqs: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage'],
  sns: ['sns:Publish'],
  dynamodb: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan'],
  ssm: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
  secretsmanager: ['secretsmanager:GetSecretValue'],
};

const SERVICE_ARN: Record<string, (region: string, accountId: string, name: string) => string | string[]> = {
  s3: (_r, _a, name) => [`arn:aws:s3:::${name}`, `arn:aws:s3:::${name}/*`],
  sqs: (r, a, name) => `arn:aws:sqs:${r}:${a}:${name}`,
  sns: (r, a, name) => `arn:aws:sns:${r}:${a}:${name}`,
  dynamodb: (r, a, name) => `arn:aws:dynamodb:${r}:${a}:table/${name}`,
  ssm: (r, a, name) => `arn:aws:ssm:${r}:${a}:parameter/${name}*`,
  secretsmanager: (r, a, name) => `arn:aws:secretsmanager:${r}:${a}:secret:${name}*`,
};

function resourceArn(service: string, hints: Record<string, string>, region: string, accountId: string): string | string[] {
  const name = hints[service] ?? '<RESOURCE_NAME>';
  const arnFn = SERVICE_ARN[service];
  return arnFn ? arnFn(region, accountId, name) : '*';
}

function buildStatements(signals: SignalMap, config: IamConfig): PolicyStatement[] {
  return signals.awsServices
    .filter(svc => SERVICE_ACTIONS[svc])
    .map(svc => ({
      Effect: 'Allow' as const,
      Action: SERVICE_ACTIONS[svc],
      Resource: resourceArn(svc, signals.resourceHints, config.region, config.accountId),
    }));
}

const TRUST_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Principal: { Service: 'pods.eks.amazonaws.com' },
    Action: ['sts:AssumeRole', 'sts:TagSession'],
  }],
});

function buildCliCommands(config: IamConfig): string[] {
  const { appName, environment, clusterName, accountId } = config;
  const name = `${appName}-${environment}`;
  const policyArn = `arn:aws:iam::${accountId}:policy/${name}`;
  const roleArn   = `arn:aws:iam::${accountId}:role/${name}`;

  return [
    `aws iam create-policy --policy-name ${name} --policy-document file://policy.json`,
    `aws iam create-role --role-name ${name} --assume-role-policy-document '${TRUST_POLICY}'`,
    `aws iam attach-role-policy --role-name ${name} --policy-arn ${policyArn}`,
    `aws eks create-pod-identity-association --cluster-name ${clusterName} --namespace ${name} --service-account ${name} --role-arn ${roleArn}`,
  ];
}

export function generateIam(signals: SignalMap, config: IamConfig): IamOutput {
  return {
    policyDocument: {
      Version: '2012-10-17',
      Statement: buildStatements(signals, config),
    },
    cliCommands: buildCliCommands(config),
  };
}
