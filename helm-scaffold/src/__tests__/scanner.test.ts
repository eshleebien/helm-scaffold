import * as path from 'path';
import { scan } from '../scanner';

const fixtures = path.join(__dirname, 'fixtures');

describe('scan', () => {
  it('returns empty SignalMap when no source files present', async () => {
    const result = await scan(path.join(fixtures, 'empty'));
    expect(result.imageUri).toBeNull();
    expect(result.containerPort).toBeNull();
    expect(result.namedVolumes).toEqual([]);
    expect(result.envVarNames).toEqual([]);
    expect(result.statefulSetCandidate).toBe(false);
    expect(result.awsServices).toEqual([]);
    expect(result.resourceHints).toEqual({});
  });

  it('extracts ECR image URI from docker-compose image field', async () => {
    const result = await scan(path.join(fixtures, 'simple'));
    expect(result.imageUri).toBe('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest');
  });

  it('extracts container port from docker-compose ports (host:container format)', async () => {
    const result = await scan(path.join(fixtures, 'simple'));
    expect(result.containerPort).toBe(3000);
  });

  it('captures env var names from docker-compose environment map', async () => {
    const result = await scan(path.join(fixtures, 'simple'));
    expect(result.envVarNames).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'APP_ENV', 'SECRET_KEY'])
    );
  });

  it('extracts container port from Dockerfile EXPOSE when docker-compose ports absent', async () => {
    const result = await scan(path.join(fixtures, 'dockerfile-only'));
    expect(result.containerPort).toBe(8080);
  });

  it('detects named volumes from docker-compose top-level volumes block', async () => {
    const result = await scan(path.join(fixtures, 'stateful'));
    expect(result.namedVolumes).toEqual(expect.arrayContaining(['app-data', 'db-data']));
    expect(result.namedVolumes).toHaveLength(2);
  });

  it('captures env var names from docker-compose environment list format', async () => {
    const result = await scan(path.join(fixtures, 'stateful'));
    expect(result.envVarNames).toEqual(
      expect.arrayContaining(['POSTGRES_HOST', 'POSTGRES_DB', 'APP_PORT'])
    );
  });

  it('detects s3 from @aws-sdk/client-s3 import in source files', async () => {
    const result = await scan(path.join(fixtures, 'aws-sdk-node'));
    expect(result.awsServices).toContain('s3');
  });

  it('detects dynamodb and sqs from boto3 client/resource calls in Python source', async () => {
    const result = await scan(path.join(fixtures, 'aws-sdk-python'));
    expect(result.awsServices).toContain('dynamodb');
    expect(result.awsServices).toContain('sqs');
  });

  it('detects s3 and ssm from aws-sdk-go imports in Go source', async () => {
    const result = await scan(path.join(fixtures, 'aws-sdk-go'));
    expect(result.awsServices).toContain('s3');
    expect(result.awsServices).toContain('ssm');
  });

  it('maps env var name patterns to AWS services', async () => {
    const result = await scan(path.join(fixtures, 'aws-env-vars'));
    expect(result.awsServices).toContain('s3');
    expect(result.awsServices).toContain('sqs');
    expect(result.awsServices).toContain('sns');
    expect(result.awsServices).toContain('dynamodb');
    expect(result.awsServices).toContain('ssm');
    expect(result.awsServices).toContain('secretsmanager');
  });

  it('extracts resource name hints from env var values', async () => {
    const result = await scan(path.join(fixtures, 'aws-env-vars'));
    expect(result.resourceHints['s3']).toBe('my-app-uploads');
    expect(result.resourceHints['sqs']).toBe('my-app-notifications');
    expect(result.resourceHints['dynamodb']).toBe('users');
  });

  it('detects AWS services from .env.example file', async () => {
    const result = await scan(path.join(fixtures, 'aws-config-files'));
    expect(result.awsServices).toContain('s3');
    expect(result.awsServices).toContain('sqs');
    expect(result.awsServices).toContain('dynamodb');
    expect(result.resourceHints['s3']).toBe('my-app-assets');
  });

  it('detects AWS services from serverless.yml provider.environment', async () => {
    const result = await scan(path.join(fixtures, 'aws-config-files'));
    expect(result.awsServices).toContain('sns');
    expect(result.awsServices).toContain('ssm');
    expect(result.awsServices).toContain('secretsmanager');
  });

  it('deduplicates awsServices when multiple sources detect the same service', async () => {
    // aws-config-files has both .env.example (S3_BUCKET) and serverless.yml — if both signal s3, it appears once
    const result = await scan(path.join(fixtures, 'aws-config-files'));
    const s3Count = result.awsServices.filter(s => s === 's3').length;
    expect(s3Count).toBe(1);
  });
});
