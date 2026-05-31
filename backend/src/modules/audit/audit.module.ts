import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * AuditModule is global so any feature module can inject AuditService
 * without explicitly importing it. Keeps the audit hookups across
 * AuthService, UserService, etc. one-line additions in those files.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
