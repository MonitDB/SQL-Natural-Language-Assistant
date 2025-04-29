import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TestController],
})
export class TestModule {}