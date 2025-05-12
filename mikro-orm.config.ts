import { Options, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from "@mikro-orm/seeder";

const config: Options = {
  driver: PostgreSqlDriver,
  clientUrl: 'postgresql://lucent_database_user:Luc3ntP@ssw0rd!2023@dpg-d01u8c2dbo4c7394va5g-a.oregon-postgres.render.com/lucent_database?sslmode=require',
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
    dropTables: false
  }
};

export default config;