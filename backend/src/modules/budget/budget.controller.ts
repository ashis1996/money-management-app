import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateBudgetDto, UpdateBudgetDto } from './dto';

@ApiTags('budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Post()
  @ApiOperation({ summary: 'Create a budget' })
  create(@User() user: any, @Body() dto: CreateBudgetDto) {
    return this.budgetService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all budgets' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  findAll(@User() user: any, @Query('activeOnly') activeOnly?: string) {
    return this.budgetService.findAll(user.id, activeOnly !== 'false');
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get budget summary with totals' })
  getSummary(@User() user: any) {
    return this.budgetService.getSummary(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget by ID' })
  findOne(@User() user: any, @Param('id') id: string) {
    return this.budgetService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update budget' })
  update(@User() user: any, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete budget' })
  delete(@User() user: any, @Param('id') id: string) {
    return this.budgetService.delete(user.id, id);
  }
}
