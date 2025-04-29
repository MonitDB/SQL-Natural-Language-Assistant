import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseFactoryService } from './database-factory.service';

@Module({
  providers: [DatabaseService, DatabaseFactoryService],
  exports: [DatabaseService, DatabaseFactoryService],
})
export class DatabaseModule {}