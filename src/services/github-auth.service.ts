import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../entities/user.entity';
import axios from 'axios';

@Injectable()
export class GithubAuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async getGithubAccessToken(code: string): Promise<string> {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');

    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    return response.data.access_token;
  }

  async getGithubUser(accessToken: string): Promise<any> {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });

    return response.data;
  }

  async authenticateWithGithub(code: string): Promise<{ accessToken: string; user: User }> {
    const githubAccessToken = await this.getGithubAccessToken(code);
    const githubUser = await this.getGithubUser(githubAccessToken);

    let user = await this.em.findOne(User, { githubId: githubUser.id.toString() });

    if (!user) {
      user = new User();
      user.githubId = githubUser.id.toString();
      user.username = githubUser.login;
      user.email = githubUser.email;
      user.avatarUrl = githubUser.avatar_url;
    }

    user.accessToken = githubAccessToken;
    await this.em.persistAndFlush(user);

    const jwtPayload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(jwtPayload);

    return { accessToken, user };
  }

  async validateUser(userId: string): Promise<User> {
    return this.em.findOne(User, { id: userId });
  }
}