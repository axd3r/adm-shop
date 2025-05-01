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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  loginUser(@Body() loginUserDTO: LoginUserDTO) {
    return this.authService.loginUser(loginUserDTO);
  }

  //verificar usuario valido
  @Get('private')
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
