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
import { GoalService } from './goal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto } from './dto';

@ApiTags('goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalController {
  constructor(private goalService: GoalService) {}

  @Post()
  @ApiOperation({ summary: 'Create a savings goal' })
  create(@User() user: any, @Body() dto: CreateGoalDto) {
    return this.goalService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean })
  findAll(@User() user: any, @Query('includeCompleted') includeCompleted?: string) {
    const include = includeCompleted !== 'false';
    return this.goalService.findAll(user.id, include);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get goals summary with overall progress' })
  getSummary(@User() user: any) {
    return this.goalService.getSummary(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get goal by ID' })
  findOne(@User() user: any, @Param('id') id: string) {
    return this.goalService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update goal' })
  update(@User() user: any, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goalService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete goal' })
  delete(@User() user: any, @Param('id') id: string) {
    return this.goalService.delete(user.id, id);
  }

  @Post(':id/contribute')
  @ApiOperation({ summary: 'Add money to a goal' })
  contribute(@User() user: any, @Param('id') id: string, @Body() dto: ContributeGoalDto) {
    return this.goalService.contribute(user.id, id, dto);
  }
}
