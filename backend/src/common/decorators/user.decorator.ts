import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  email: string;
}

/**
 * Param decorator that resolves to the authenticated user attached to the
 * request by Passport. Always typed as RequestUser so callers no longer
 * need `@User() user: any`.
 */
export const User = createParamDecorator((data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
