import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MikroORM } from '@mikro-orm/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Run migrations on startup
  const orm = app.get(MikroORM);
  const migrator = orm.getMigrator();
  await migrator.up();

  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
