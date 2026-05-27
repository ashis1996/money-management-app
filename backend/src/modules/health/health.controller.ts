import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';

/**
 * Lightweight health endpoint used by:
 *   - Docker HEALTHCHECK
 *   - scripts/compose-smoke.sh readiness probe
 *   - Mobile app connectivity check
 *
 * Kept dependency-free on purpose: a 200 response means the HTTP server is
 * up. The deeper `/health/ready` probe additionally checks the database so
 * the smoke test can wait until migrations have completed.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return {
      status: 'ok',
      service: 'money-management-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks database)' })
  async readiness() {
    const checks: Record<string, string> = {};
    let healthy = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (err: any) {
      checks.database = `error: ${err?.message ?? 'unknown'}`;
      healthy = false;
    }

    checks.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'unset';

    return {
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
