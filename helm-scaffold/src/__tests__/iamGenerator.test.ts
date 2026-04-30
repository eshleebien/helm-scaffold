import { generateIam, IamConfig } from '../iamGenerator';
import { SignalMap } from '../scanner';

const baseSignals: SignalMap = {
  imageUri: null,
  containerPort: null,
  namedVolumes: [],
  envVarNames: [],
  statefulSetCandidate: false,
  awsServices: ['s3', 'sqs', 'ssm', 'dynamodb'],
  resourceHints: { s3: 'my-app-uploads', dynamodb: 'users' },
};

const baseConfig: IamConfig = {
  appName: 'my-app',
  environment: 'prod',
  clusterName: 'my-cluster',
  accountId: '123456789012',
  region: 'us-east-1',
};

describe('generateIam', () => {
  it('policy document has Version and a non-empty Statement array', () => {
    const { policyDocument } = generateIam(baseSignals, baseConfig);

    expect(policyDocument.Version).toBe('2012-10-17');
    expect(Array.isArray(policyDocument.Statement)).toBe(true);
    expect(policyDocument.Statement.length).toBeGreaterThan(0);
  });

  it('S3 statement has correct actions and uses resourceHint in ARN', () => {
    const { policyDocument } = generateIam(baseSignals, baseConfig);
    const s3 = policyDocument.Statement.find(s => s.Action.some(a => a.startsWith('s3:')));

    expect(s3).toBeDefined();
    expect(s3!.Action).toEqual(expect.arrayContaining(['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket']));

    const arns = ([] as string[]).concat(s3!.Resource as string | string[]);
    expect(arns.some(a => a.includes('my-app-uploads'))).toBe(true);
  });

  it('SQS, DynamoDB, SSM, and secretsmanager statements have correct actions', () => {
    const signals: SignalMap = {
      ...baseSignals,
      awsServices: ['sqs', 'dynamodb', 'ssm', 'secretsmanager'],
      resourceHints: {},
    };
    const { policyDocument } = generateIam(signals, baseConfig);

    const actionsFor = (prefix: string) =>
      policyDocument.Statement.find(s => s.Action.some(a => a.startsWith(prefix)))?.Action ?? [];

    expect(actionsFor('sqs:')).toEqual(expect.arrayContaining(['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage']));
    expect(actionsFor('dynamodb:')).toEqual(expect.arrayContaining(['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:Scan']));
    expect(actionsFor('ssm:')).toEqual(expect.arrayContaining(['ssm:GetParameter', 'ssm:GetParametersByPath']));
    expect(actionsFor('secretsmanager:')).toEqual(expect.arrayContaining(['secretsmanager:GetSecretValue']));
  });

  it('create-policy command uses <app>-<env> name', () => {
    const { cliCommands } = generateIam(baseSignals, baseConfig);
    const cmd = cliCommands.find(c => c.includes('create-policy'));

    expect(cmd).toBeDefined();
    expect(cmd).toContain('--policy-name my-app-prod');
  });

  it('attach-role-policy command references customer policy ARN', () => {
    const { cliCommands } = generateIam(baseSignals, baseConfig);
    const cmd = cliCommands.find(c => c.includes('attach-role-policy'));

    expect(cmd).toBeDefined();
    expect(cmd).toContain('--role-name my-app-prod');
    expect(cmd).toContain('arn:aws:iam::123456789012:policy/my-app-prod');
  });

  it('create-pod-identity-association uses <app>-<env> for namespace and service account', () => {
    const { cliCommands } = generateIam(baseSignals, baseConfig);
    const cmd = cliCommands.find(c => c.includes('create-pod-identity-association'));

    expect(cmd).toBeDefined();
    expect(cmd).toContain('--namespace my-app-prod');
    expect(cmd).toContain('--service-account my-app-prod');
    expect(cmd).toContain('--cluster-name my-cluster');
    expect(cmd).toContain('arn:aws:iam::123456789012:role/my-app-prod');
  });

  it('create-role command uses EKS Pod Identity trust principal', () => {
    const { cliCommands } = generateIam(baseSignals, baseConfig);
    const cmd = cliCommands.find(c => c.includes('create-role'));

    expect(cmd).toBeDefined();
    expect(cmd).toContain('pods.eks.amazonaws.com');
    expect(cmd).not.toContain('oidc');
  });

  it('output contains no AWS managed policy ARNs', () => {
    const { policyDocument, cliCommands } = generateIam(baseSignals, baseConfig);
    const allText = JSON.stringify(policyDocument) + cliCommands.join('\n');

    expect(allText).not.toMatch(/arn:aws:iam::aws:policy/);
  });

  it('S3 resource ARN uses <RESOURCE_NAME> placeholder when no hint available', () => {
    const signals = { ...baseSignals, awsServices: ['s3'], resourceHints: {} };
    const { policyDocument } = generateIam(signals, baseConfig);
    const s3 = policyDocument.Statement[0];

    const arns = ([] as string[]).concat(s3.Resource as string | string[]);
    expect(arns.some(a => a.includes('<RESOURCE_NAME>'))).toBe(true);
  });
});
