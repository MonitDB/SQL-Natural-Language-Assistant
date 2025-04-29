import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskRequestDto {
  @ApiProperty({
    description: 'Database username',
    example: 'your_username',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Database password',
    example: 'your_password',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'Database connection string (format depends on the database type)',
    example: 'db-host:1521/orcl or db-host:5432',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  connectionString: string;

  @ApiProperty({
    description: 'Database port (if not included in connection string)',
    example: 1521,
    required: false,
    default: 1521
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  port: number = 1521;

  @ApiProperty({
    description: 'Database type (oracle, postgres, mysql, mssql)',
    example: 'oracle',
    required: false,
    default: 'oracle'
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({
    description: 'Database host (for PostgreSQL, MySQL, and MSSQL)',
    example: 'localhost',
    required: false
  })
  @IsString()
  @IsOptional()
  host?: string;

  @ApiProperty({
    description: 'Database name (required for PostgreSQL, MySQL, and MSSQL)',
    example: 'mydb',
    required: false
  })
  @IsString()
  @IsOptional()
  database?: string;
  
  @ApiProperty({
    description: 'Specific schema/entity to focus on (e.g., dbo, APPLICATION, HISTORIC, SOL)',
    example: 'dbo',
    required: false
  })
  @IsString()
  @IsOptional()
  schema?: string;

  @ApiProperty({
    description: 'Natural language query to be translated to SQL',
    example: 'Show me all customers who ordered more than 5 items last month',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}