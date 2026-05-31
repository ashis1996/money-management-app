import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by JwtAuthGuard (and any future global auth guard)
 * to identify routes that should bypass authentication.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route handler or controller as public — i.e. authentication is
 * skipped. The guard reads `IS_PUBLIC_KEY` from metadata via Reflector.
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
