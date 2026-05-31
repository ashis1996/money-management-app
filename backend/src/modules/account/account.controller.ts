import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, RequestUser } from '../../common/decorators/user.decorator';
import { CreateAccountDto, UpdateAccountDto } from './dto';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Post()
  @ApiOperation({ summary: 'Add an account' })
  create(@User() user: RequestUser, @Body() dto: CreateAccountDto) {
    return this.accountService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List accounts' })
  @ApiQuery({ name: 'type', required: false, type: String })
  findAll(@User() user: RequestUser, @Query('type') type?: string) {
    return this.accountService.findAll(user.id, type);
  }

  @Get('net-worth')
  @ApiOperation({ summary: 'Get net worth and asset/liability breakdown' })
  getNetWorth(@User() user: RequestUser) {
    return this.accountService.getNetWorth(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  findOne(@User() user: RequestUser, @Param('id') id: string) {
    return this.accountService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update account' })
  update(@User() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove account' })
  delete(@User() user: RequestUser, @Param('id') id: string) {
    return this.accountService.delete(user.id, id);
  }

  @Post(':id/primary')
  @ApiOperation({ summary: 'Set as primary account' })
  setPrimary(@User() user: RequestUser, @Param('id') id: string) {
    return this.accountService.setPrimary(user.id, id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Recompute balance from transactions' })
  sync(@User() user: RequestUser, @Param('id') id: string) {
    return this.accountService.sync(user.id, id);
  }
}
