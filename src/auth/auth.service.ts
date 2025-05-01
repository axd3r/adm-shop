import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginUserDTO } from './dto/login-user.dto';
import { handleDBExceptions } from 'src/common/helpers/handleExceptions.helper';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { instanceToPlain } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from './interfaces/jwt-payload.interfcae';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) 
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService
  ){}
  async loginUser(loginUserDTO: LoginUserDTO) {
    const {email, password} = loginUserDTO

    const user = await this.userRepository.findOne({ where: {email}, select: {email: true, password: true, id: true, fullName: true} });

    if(!user) 
      throw new UnauthorizedException('Credentials are not valid (email)');
    
    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');
    
    const { password: _, ...rest } = user;

    return {
      user: rest,
      token: this.getJwtToken({id: user.id})
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }
 
  async checkAuthStatus( user: User ) {
    return {
      ...user,
      token: this.getJwtToken({id: user.id})
    }
  }
/* 
  remove(id: number) {
    return `This action removes a #${id} auth`;
  } */
}
