import { Module } from '@nestjs/common';
import { ActionCardController } from './action-card.controller';
import { ActionCardService } from './action-card.service';

@Module({
  controllers: [ActionCardController],
  providers: [ActionCardService],
  exports: [ActionCardService],
})
export class ActionCardModule {}
