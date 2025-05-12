import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Repository } from '../entities/repository.entity';
import { User } from '../entities/user.entity';
import axios from 'axios';

@Injectable()
export class RepositoryService {
  constructor(private readonly em: EntityManager) {}

  async getUserRepositories(user: User): Promise<Repository[]> {
    // First check if we have repositories for this user in our database
    const existingRepos = await this.em.find(Repository, { owner: user });

    if (existingRepos.length > 0) {
      return existingRepos;
    }

    // If not, fetch from GitHub API
    return this.fetchAndSaveUserRepositories(user);
  }

  async fetchAndSaveUserRepositories(user: User): Promise<Repository[]> {
    try {
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: {
          Authorization: `token ${user.accessToken}`,
        },
        params: {
          sort: 'updated',
          per_page: 100,
        },
      });

      const repositories: Repository[] = [];

      for (const repo of response.data) {
        const repository = new Repository();
        repository.githubId = repo.id.toString();
        repository.name = repo.name;
        repository.fullName = repo.full_name;
        repository.description = repo.description;
        repository.url = repo.html_url;
        repository.owner = user;

        repositories.push(repository);
        this.em.persist(repository);
      }

      await this.em.flush();
      return repositories;
    } catch (error) {
      console.error('Error fetching repositories from GitHub:', error);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  async getRepositoryById(id: string): Promise<Repository> {
    const repository = await this.em.findOne(Repository, { id });
    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }
    return repository;
  }

  async activateRepository(id: string, userId: string): Promise<Repository> {
    const repository = await this.em.findOne(Repository, { id });
    const user = await this.em.findOne(User, { id: userId });

    if (!repository || !user || repository.owner.id !== user.id) {
      throw new Error('Repository not found or not owned by user');
    }

    repository.isActive = true;
    await this.em.persistAndFlush(repository);

    return repository;
  }

  async deactivateRepository(id: string, userId: string): Promise<Repository> {
    const repository = await this.em.findOne(Repository, { id });
    const user = await this.em.findOne(User, { id: userId });

    if (!repository || !user || repository.owner.id !== user.id) {
      throw new Error('Repository not found or not owned by user');
    }

    repository.isActive = false;
    await this.em.persistAndFlush(repository);

    return repository;
  }
}
