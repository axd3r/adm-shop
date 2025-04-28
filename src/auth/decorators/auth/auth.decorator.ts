import { applyDecorators, UseGuards } from '@nestjs/common';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { RoleProtected } from '../role-protected/role-protected.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';

export function Auth(...roles: ValidRoles[]) {
  
  const decorators = [ UseGuards(AuthGuard()) ];

  if (roles.length > 0) {
    decorators.push(
      RoleProtected(...roles),
      UseGuards(UserRoleGuard)
    );
  }

  return applyDecorators(...decorators);
}
