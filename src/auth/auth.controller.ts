import { Controller, Get, Post, Body, UseGuards, Req, SetMetadata } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDTO } from './dto/login-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { GetUser } from './decorators/get-user.decorator';
import { User } from 'src/modules/users/entities/user.entity';
import { GetHeaders } from './decorators/get-headers.decorator';
import { UserRoleGuard } from './guards/user-role/user-role.guard';
import { RoleProtected } from './decorators/role-protected/role-protected.decorator';
import { ValidRoles } from './interfaces/valid-roles';
import { Auth } from './decorators/auth/auth.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Returns user with JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  loginUser(@Body() loginUserDTO: LoginUserDTO) {
    return this.authService.loginUser(loginUserDTO);
  }

  //verificar usuario valido
  @Get('private')
  @ApiOperation({ summary: 'Test private route (JWT required)' })
  @ApiResponse({ status: 200, description: 'Returns user data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard())
  findUserInfo(
    @Req() request: Request,
    @GetUser() user: User,
    @GetUser('email') userEmail: string,
    @GetHeaders('authorization') header: string[]
  ) {
      
    return {
      ok: true,
      user,
      userEmail,
      header
    }
  }

  //verificar role
  @Get('private2')
  @ApiOperation({ summary: 'Private route with role check (admin or superUser)' })
  @ApiResponse({ status: 200, description: 'Authorized access for admin or superUser' })
  @ApiResponse({ status: 403, description: 'Forbidden, role not allowed' })
  //@SetMetadata('roles', ['admin', 'super-user'])
  @RoleProtected( ValidRoles.superUser, ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  anotherFindUserInfo(
    @Req() request: Request,
    @GetUser() user: User,
    @GetUser('email') userEmail: string,
    @GetHeaders('authorization') header: string[]
  ) {
      
    return {
      ok: true,
      user,
      userEmail,
      header
    }
  }

  //verificar role forma de nestjs
  @Get('private3')
  @ApiOperation({ summary: 'Private route using custom Auth decorator (admin only)' })
  @ApiResponse({ status: 200, description: 'Authorized admin access' })
  @ApiResponse({ status: 403, description: 'Forbidden, role not allowed' })
  @Auth(ValidRoles.admin)
  anotherFindUserInf(
    @GetUser() user: User,
  ) {
    return {
      ok: true,
      user
    }
  }
  
  @Get('check-auth-status')
  @ApiOperation({ summary: 'Check auth status for logged-in user' })
  @ApiResponse({ status: 200, description: 'Returns user and new JWT token if valid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Auth()
  checkAuthStatus(
    @GetUser() user: User
  ) {
    return this.authService.checkAuthStatus(user);
  }
  
  /*
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  } */
}
