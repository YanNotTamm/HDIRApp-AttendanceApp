import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Identity taken ONLY from the verified JWT (populated by JwtAuthGuard).
// Controllers must never read userId / approvedBy from the request body.
export interface CurrentUserData {
  id: number;
  email: string;
  role: string;
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    return ctx.switchToHttp().getRequest().user;
  },
);
