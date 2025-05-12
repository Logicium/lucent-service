import { Options, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from "@mikro-orm/seeder";
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config: Options = {
  driver: PostgreSqlDriver,
  clientUrl: process.env.DATABASE_URL || 'postgresql://lucent_db_user:98kG27xRK8Mgye70C1DQJ3ZLi5OjsZlz@dpg-d0h6s8umcj7s73fi43jg-a.oregon-postgres.render.com/lucent_db',
  extensions: [SeedManager, Migrator],
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  metadataProvider: TsMorphMetadataProvider,
  debug: true,
  driverOptions: {
    connection: {
      ssl: true,
    },
  },
  seeder: {
    path: './src/seeders', // path to the folder with seeders
    pathTs: undefined, // path to the folder with TS seeders (if used, we should put path to compiled files in `path`)
    defaultSeeder: 'DatabaseSeeder', // default seeder class name
    glob: '!(*.d).{js,ts}', // how to match seeder files (all .js and .ts files, but not .d.ts)
    emit: 'ts', // seeder generation mode
    fileName: (className: string) => className, // seeder file naming convention
  },
  migrations: {
    path: './dist/migrations',
    pathTs: './src/migrations',
    dropTables: false,
    allOrNothing: true,
    safe: true
  }
};

export default config;
