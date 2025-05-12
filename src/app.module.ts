import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { JwtModule } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { Repository } from './entities/repository.entity';
import { Commit } from './entities/commit.entity';
import { GithubAuthService } from './services/github-auth.service';
import { GithubAuthController } from './controllers/github-auth.controller';
import { RepositoryService } from './services/repository.service';
import { RepositoryController } from './controllers/repository.controller';
import { CommitService } from './services/commit.service';
import { CommitController } from './controllers/commit.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forRoot(),
    MikroOrmModule.forFeature([User, Repository, Commit]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'lucent-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AppController, GithubAuthController, RepositoryController, CommitController],
  providers: [AppService, GithubAuthService, RepositoryService, CommitService],
})
export class AppModule {}
