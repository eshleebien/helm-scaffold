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
});
