import { ApiProperty } from '@nestjs/swagger';

export class AskResponseDto {
  @ApiProperty({
    description: 'Human-readable summary of the query results',
    example: 'The query returned 5 customers who ordered more than 5 items in March 2023. The top customer was John Smith with 12 orders.'
  })
  result: string;

  @ApiProperty({
    description: 'SQL queries that were executed against the database',
    example: ['SELECT customer_name, COUNT(order_id) as order_count FROM orders WHERE order_date >= TO_DATE(\'2023-03-01\', \'YYYY-MM-DD\') AND order_date <= TO_DATE(\'2023-03-31\', \'YYYY-MM-DD\') GROUP BY customer_name HAVING COUNT(order_id) > 5 ORDER BY order_count DESC'],
    type: [String]
  })
  executedQueries: string[];

  @ApiProperty({
    description: 'Raw results returned from executed SQL queries',
    example: [[
      { "CUSTOMER_NAME": "John Smith", "ORDER_COUNT": 12 },
      { "CUSTOMER_NAME": "Jane Doe", "ORDER_COUNT": 8 }
    ]],
    type: 'array',
    isArray: true
  })
  rawResults: any[];
  
  @ApiProperty({
    description: 'Suggested follow-up prompts based on current query results',
    example: [
      'What was the total revenue from these top customers?',
      'How do these order counts compare to the previous month?',
      'Which products were most frequently ordered by these customers?'
    ],
    type: [String],
    required: false
  })
  suggestedPrompts?: string[];
  
  @ApiProperty({
    description: 'Error information if there was an issue during query processing',
    example: {
      error: true,
      message: 'Rate limit exceeded',
      type: 'RATE_LIMIT_EXCEEDED'
    },
    required: false
  })
  errorInfo?: {
    error: boolean;
    message: string;
    type: string;
  };
}