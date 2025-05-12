import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { User } from './user.entity';

@Entity()
export class Repository {
  @PrimaryKey()
  id: string = v4();

  @Property()
  githubId: string;

  @Property()
  name: string;

  @Property()
  fullName: string;

  @Property({ nullable: true })
  description?: string;

  @Property()
  url: string;

  @ManyToOne(() => User)
  owner: User;

  @Property({ default: false })
  isActive: boolean = false;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}