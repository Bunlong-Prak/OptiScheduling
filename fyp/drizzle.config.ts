import { DB_URL } from "@/drizzle/db";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    out: "./src/drizzle/migrations",
    schema: "./src/drizzle/schema.ts",
    dialect: "mysql",
    dbCredentials: {
        url: DB_URL,
    },
});
