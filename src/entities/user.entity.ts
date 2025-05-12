import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 } from 'uuid';

@Entity()
export class User {
  @PrimaryKey()
  id: string = v4();

  @Property()
  githubId: string;

  @Property()
  username: string;

  @Property({ nullable: true })
  email?: string;

  @Property({ nullable: true })
  avatarUrl?: string;

  @Property({ nullable: true })
  accessToken?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}