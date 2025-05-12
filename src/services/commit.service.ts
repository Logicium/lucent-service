import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Commit } from '../entities/commit.entity';
import { Repository } from '../entities/repository.entity';
import { User } from '../entities/user.entity';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class CommitService {
  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
  ) {}

  async getRepositoryCommits(repositoryId: string, userId: string): Promise<Commit[]> {
    const repository = await this.em.findOne(Repository, { id: repositoryId });
    const user = await this.em.findOne(User, { id: userId });

    if (!repository || !user || repository.owner.id !== user.id) {
      throw new Error('Repository not found or not owned by user');
    }

    // First check if we have commits for this repository in our database
    const existingCommits = await this.em.find(Commit, { repository });

    if (existingCommits.length > 0) {
      return existingCommits;
    }

    // If not, fetch from GitHub API
    return this.fetchAndSaveRepositoryCommits(repository, user);
  }

  async fetchAndSaveRepositoryCommits(repository: Repository, user: User): Promise<Commit[]> {
    try {
      const [owner, repo] = repository.fullName.split('/');
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
        headers: {
          Authorization: `token ${user.accessToken}`,
        },
        params: {
          per_page: 100,
        },
      });

      const commits: Commit[] = [];

      for (const commit of response.data) {
        const newCommit = new Commit();
        newCommit.sha = commit.sha;
        newCommit.message = commit.commit.message;
        newCommit.authorName = commit.commit.author?.name;
        newCommit.authorEmail = commit.commit.author?.email;
        newCommit.date = new Date(commit.commit.author?.date);
        newCommit.repository = repository;

        commits.push(newCommit);
        this.em.persist(newCommit);
      }

      await this.em.flush();
      return commits;
    } catch (error) {
      console.error('Error fetching commits from GitHub:', error);
      throw new Error('Failed to fetch commits from GitHub');
    }
  }

  async getCommitById(id: string): Promise<Commit> {
    const commit = await this.em.findOne(Commit, { id });
    if (!commit) {
      throw new NotFoundException(`Commit with ID ${id} not found`);
    }
    return commit;
  }

  async generateArticleForCommit(commitId: string, userId: string): Promise<Commit> {
    const commit = await this.em.findOne(Commit, { id: commitId }, { populate: ['repository'] });
    const user = await this.em.findOne(User, { id: userId });

    if (!commit || !user || commit.repository.owner.id !== user.id) {
      throw new Error('Commit not found or not owned by user');
    }

    if (commit.articleGenerated) {
      return commit; // Article already generated
    }

    // Fetch commit details including code changes
    const [owner, repo] = commit.repository.fullName.split('/');
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`, {
      headers: {
        Authorization: `token ${user.accessToken}`,
        Accept: 'application/vnd.github.v3.diff',
      },
    });

    const codeChanges = response.data;

    // Generate article using Google Gemini API (placeholder for now)
    const articleContent = await this.generateArticleWithGemini(commit.message, codeChanges);

    // Update commit with generated article
    commit.articleContent = articleContent;
    commit.articleGenerated = true;
    await this.em.persistAndFlush(commit);

    return commit;
  }

  private async generateArticleWithGemini(commitMessage: string, codeChanges: string): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables');
      }

      // Initialize the Gemini API client
      const genAI = new GoogleGenerativeAI(apiKey);

      // Use the gemini-2.0-flash model as specified
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // Prepare the prompt for generating the article
      const prompt = `
      You are a technical writer creating a how-to article based on a Git commit.

      Commit Message: ${commitMessage}

      Code Changes:
      \`\`\`diff
      ${codeChanges}
      \`\`\`

      Please generate a comprehensive how-to article that:
      1. Has a clear title based on the commit message
      2. Explains what the code changes do in a clear, concise manner
      3. Provides step-by-step instructions on how to use the feature or fix that was implemented
      4. Includes code examples where appropriate
      5. Uses markdown formatting for better readability

      Format the article with proper markdown headings, code blocks, and sections.
      `;

      // Generate content
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text;
    } catch (error) {
      console.error('Error generating article with Gemini:', error);

      // Fallback to a basic article if the API call fails
      return `# How-to Article: ${commitMessage}\n\n` +
        `This article explains the changes made in this commit.\n\n` +
        `## Code Changes\n\n` +
        `\`\`\`diff\n${codeChanges}\n\`\`\`\n\n` +
        `## Explanation\n\n` +
        `[Error generating AI explanation. Please try again later.]`;
    }
  }

  async updateArticleContent(commitId: string, articleContent: string, userId: string): Promise<Commit> {
    const commit = await this.em.findOne(Commit, { id: commitId }, { populate: ['repository'] });

    if (!commit) {
      throw new NotFoundException(`Commit with ID ${commitId} not found`);
    }

    const user = await this.em.findOne(User, { id: userId });

    if (!user || commit.repository.owner.id !== user.id) {
      throw new UnauthorizedException('Not authorized to update this article');
    }

    if (!commit.articleGenerated) {
      throw new Error('No article has been generated for this commit yet');
    }

    commit.articleContent = articleContent;
    await this.em.persistAndFlush(commit);

    return commit;
  }

  async getGeneratedArticles(userId: string): Promise<Commit[]> {
    const user = await this.em.findOne(User, { id: userId });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Find all repositories owned by the user
    const repositories = await this.em.find(Repository, { owner: user });

    if (repositories.length === 0) {
      return [];
    }

    // Find all commits with generated articles for these repositories
    return this.em.find(Commit, {
      repository: { $in: repositories.map(repo => repo.id) },
      articleGenerated: true
    }, { populate: ['repository'] });
  }
}
