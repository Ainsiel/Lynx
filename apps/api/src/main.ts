import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  })

  const config = new DocumentBuilder()
    .setTitle('LYNX API')
    .setDescription('URL Shortener with Analytics — API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log(`LYNX api escuchando en http://localhost:${port}`)
  console.log(`Swagger docs en http://localhost:${port}/api/docs`)
}

void bootstrap()
