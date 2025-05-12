import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Repository } from './repository.entity';

@Entity()
export class Commit {
  @PrimaryKey()
  id: string = v4();

  @Property()
  sha: string;

  @Property()
  message: string;

  @Property({ nullable: true })
  authorName?: string;

  @Property({ nullable: true })
  authorEmail?: string;

  @Property()
  date: Date;

  @ManyToOne(() => Repository)
  repository: Repository;

  @Property({ nullable: true })
  articleContent?: string;

  @Property({ default: false })
  articleGenerated: boolean = false;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}