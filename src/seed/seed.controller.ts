import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SeedService } from './seed.service';
import { Auth } from 'src/auth/decorators/auth/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  //@Auth(ValidRoles.admin)
  @ApiOperation({ summary: 'Run database seed' })
  @ApiResponse({ status: 200, description: 'Seed executed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  executeSeed() {
    return this.seedService.executeSeed();
  }
}
