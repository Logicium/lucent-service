import { Controller, Get, Param, Post, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { RepositoryService } from '../services/repository.service';
import { GithubAuthService } from '../services/github-auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('repositories')
export class RepositoryController {
  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly githubAuthService: GithubAuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserRepositories(@Request() req) {
    const user = await this.githubAuthService.validateUser(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    return this.repositoryService.getUserRepositories(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getRepository(@Param('id') id: string) {
    return this.repositoryService.getRepositoryById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/activate')
  async activateRepository(@Param('id') id: string, @Request() req) {
    return this.repositoryService.activateRepository(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/deactivate')
  async deactivateRepository(@Param('id') id: string, @Request() req) {
    return this.repositoryService.deactivateRepository(id, req.user.userId);
  }
}