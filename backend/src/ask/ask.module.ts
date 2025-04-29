import { Module } from '@nestjs/common';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { DatabaseModule } from '../database/database.module';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [DatabaseModule, OpenaiModule],
  controllers: [AskController],
  providers: [AskService],
  exports: [AskService],
})
export class AskModule {}