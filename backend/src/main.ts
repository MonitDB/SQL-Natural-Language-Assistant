import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for all origins
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Enable validation pipe for all requests
  app.useGlobalPipes(new ValidationPipe());
  
  // Set up Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Oracle Database Natural Language Query API')
    .setDescription('A bridge between natural language queries and Oracle databases')
    .setVersion('1.0')
    .addTag('ask', 'Query Oracle database using natural language')
    .addTag('test', 'Test Oracle database connectivity')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  // Start server on port 3005 or environment variable PORT
  const port = process.env.PORT || 3005;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();