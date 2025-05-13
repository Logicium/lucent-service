import { Controller, Get, Param, Post, Put, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { CommitService } from '../services/commit.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('commits')
export class CommitController {
  constructor(private readonly commitService: CommitService) {}

  @UseGuards(JwtAuthGuard)
  @Get('repository/:repositoryId')
  async getRepositoryCommits(@Param('repositoryId') repositoryId: string, @Request() req) {
    return this.commitService.getRepositoryCommits(repositoryId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getCommit(@Param('id') id: string) {
    return this.commitService.getCommitById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/generate-article')
  async generateArticle(
    @Param('id') id: string, 
    @Body() generateArticleDto: { docType: string; forceRegenerate: boolean },
    @Request() req
  ) {
    return this.commitService.generateArticleForCommit(
      id, 
      req.user.userId, 
      generateArticleDto.docType || 'article',
      generateArticleDto.forceRegenerate || false
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/update-article')
  async updateArticle(
    @Param('id') id: string,
    @Body() updateArticleDto: { articleContent: string },
    @Request() req
  ) {
    return this.commitService.updateArticleContent(id, updateArticleDto.articleContent, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getArticles(@Request() req) {
    return this.commitService.getGeneratedArticles(req.user.userId);
  }
}
