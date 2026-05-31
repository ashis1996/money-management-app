import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateTransactionDto, UpdateTransactionDto, TransactionsFilterDto } from '@money-management/shared/dto';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  create(@User() user: any, @Body() dto: CreateTransactionDto) {
    return this.transactionService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions (paginated)' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number, 1-indexed. Default: 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size. Default: 20. Max: 100.',
  })
  findAll(@User() user: any, @Query() filters: TransactionsFilterDto) {
    return this.transactionService.findAll(user.id, filters);
  }

  @Get('analytics/categories')
  @ApiOperation({ summary: 'Get spending by category' })
  getCategories(@User() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.transactionService.getCategories(user.id, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('analytics/monthly')
  @ApiOperation({ summary: 'Get monthly statistics' })
  @ApiQuery({ name: 'year', type: Number })
  @ApiQuery({ name: 'month', type: Number })
  getMonthlyStats(@User() user: any, @Query('year') year: number, @Query('month') month: number) {
    return this.transactionService.getMonthlyStats(user.id, year, month);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search transactions' })
  @ApiQuery({ name: 'q', type: String })
  search(@User() user: any, @Query('q') query: string) {
    return this.transactionService.search(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  findOne(@User() user: any, @Param('id') id: string) {
    return this.transactionService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update transaction' })
  update(@User() user: any, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete transaction' })
  delete(@User() user: any, @Param('id') id: string) {
    return this.transactionService.delete(user.id, id);
  }
}
