import { Controller, Get, Query, Redirect, Req, Res, UnauthorizedException } from '@nestjs/common';
import { GithubAuthService } from '../services/github-auth.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Controller('auth/github')
export class GithubAuthController {
  constructor(
    private readonly githubAuthService: GithubAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('login')
  @Redirect()
  login() {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const redirectUri = this.configService.get<string>('GITHUB_REDIRECT_URI');

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email,repo`;

    return { url: githubAuthUrl };
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      throw new UnauthorizedException('No authorization code provided');
    }

    try {
      const { accessToken, user } = await this.githubAuthService.authenticateWithGithub(code);

      // Redirect to frontend with token as URL parameter
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?token=${accessToken}`);
    } catch (error) {
      console.error('GitHub authentication error:', error);
      throw new UnauthorizedException('Failed to authenticate with GitHub');
    }
  }

  @Get('user')
  async getUser(@Req() req) {
    // This endpoint would typically use a JWT guard to validate the token
    // For now, we'll just return a placeholder
    return { message: 'This endpoint will return the authenticated user' };
  }
}
