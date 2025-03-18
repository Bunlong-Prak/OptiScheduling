# Migration Usage

`npx drizzle-kit generate` lets you generate SQL migration files based on your Drizzle schema either upon declaration or on subsequent changes.

`npx drizzle-kit migrate` lets you apply generated SQL migration files to your database.

`npx drizzle-kit pull` lets you pull (introspect) database schema, convert it to Drizzle schema and save it to your codebase.

`npx drizzle-kit push` lets you push your Drizzle schema to database either upon declaration or on subsequent schema changes.

`npx drizzle-kit studio` will connect to your database and spin up a proxy server for Drizzle Studio which you can use for convenient database browsing.

`npx drizzle-kit check` will walk through all generated migrations and check for any race conditions (collisions) of generated migrations.

`npx drizzle-kit up` is used to upgrade snapshots of previously generated migrations.