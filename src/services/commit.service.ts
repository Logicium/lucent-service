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

  async generateArticleForCommit(
    commitId: string, 
    userId: string, 
    docType: string = 'article',
    forceRegenerate: boolean = false
  ): Promise<Commit> {
    const commit = await this.em.findOne(Commit, { id: commitId }, { populate: ['repository'] });
    const user = await this.em.findOne(User, { id: userId });

    if (!commit || !user || commit.repository.owner.id !== user.id) {
      throw new Error('Commit not found or not owned by user');
    }

    // If article is already generated and we're not forcing regeneration, return the existing article
    if (commit.articleGenerated && !forceRegenerate) {
      return commit;
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

    // Generate article using Google Gemini API with the specified document type
    const articleContent = await this.generateArticleWithGemini(commit.message, codeChanges, docType);

    // Update commit with generated article
    commit.articleContent = articleContent;
    commit.articleGenerated = true;
    await this.em.persistAndFlush(commit);

    return commit;
  }

  private async generateArticleWithGemini(
    commitMessage: string, 
    codeChanges: string, 
    docType: string = 'article'
  ): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables');
      }

      // Initialize the Gemini API client
      const genAI = new GoogleGenerativeAI(apiKey);

      // Use the gemini-2.0-flash model as specified
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // Select the appropriate prompt based on the document type
      let prompt = '';

      switch (docType) {
        case 'api':
          prompt = `
          You are a technical writer creating API documentation based on a Git commit.

          Commit Message: ${commitMessage}

          Code Changes:
          \`\`\`diff
          ${codeChanges}
          \`\`\`

          Please generate comprehensive API documentation in Swagger/OpenAPI style that:
          1. Has a clear title and description for each endpoint or component
          2. Lists all parameters, request bodies, and response formats
          3. Includes example requests and responses
          4. Documents any authentication requirements
          5. Uses markdown formatting for better readability

          Format the documentation with proper markdown headings, code blocks, and sections.
          `;
          break;

        case 'faq':
          prompt = `
          You are a technical writer creating a FAQ document based on a Git commit.

          Commit Message: ${commitMessage}

          Code Changes:
          \`\`\`diff
          ${codeChanges}
          \`\`\`

          Please generate a comprehensive FAQ document that:
          1. Anticipates common questions users might have about this change
          2. Provides clear, concise answers to each question
          3. Covers both basic and advanced usage scenarios
          4. Includes troubleshooting questions and solutions
          5. Uses markdown formatting for better readability

          Format the FAQ with proper markdown headings and sections.
          `;
          break;

        case 'slides':
          prompt = `
          You are a technical writer creating presentation slide content based on a Git commit.

          Commit Message: ${commitMessage}

          Code Changes:
          \`\`\`diff
          ${codeChanges}
          \`\`\`

          Please generate content for a technical presentation that:
          1. Has a clear title slide and agenda
          2. Explains the purpose and context of the changes
          3. Highlights key technical details with code snippets
          4. Includes bullet points for easy presentation
          5. Ends with a summary and next steps

          Format the content as a series of slides using markdown, with clear slide breaks and titles.
          `;
          break;

        case 'video':
          prompt = `
          You are a technical writer creating a video script based on a Git commit.

          Commit Message: ${commitMessage}

          Code Changes:
          \`\`\`diff
          ${codeChanges}
          \`\`\`

          Please generate a comprehensive video script that:
          1. Has a clear introduction explaining the purpose of the changes
          2. Walks through the code changes in a logical order
          3. Explains technical concepts in an accessible way
          4. Includes cues for when to show code on screen
          5. Ends with a summary and call to action

          Format the script with clear sections for introduction, main content, and conclusion.
          `;
          break;

        case 'release':
          prompt = `
          You are a technical writer creating release notes based on a Git commit.

          Commit Message: ${commitMessage}

          Code Changes:
          \`\`\`diff
          ${codeChanges}
          \`\`\`

          Please generate comprehensive release notes that:
          1. Summarize the changes in a clear, concise manner
          2. List new features, improvements, and bug fixes
          3. Include any breaking changes and migration instructions
          4. Mention any dependencies that were added or updated
          5. Uses markdown formatting for better readability

          Format the release notes with proper markdown headings, bullet points, and sections.
          `;
          break;

        case 'article':
        default:
          prompt = `
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
          break;
      }

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
