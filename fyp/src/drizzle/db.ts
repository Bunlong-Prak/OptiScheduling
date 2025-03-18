import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

export const DB_URL = process.env.DATABASE_URL ?? "";

export const db = drizzle({
    connection: DB_URL,
    schema: schema,
    mode: "default",
});

export type DB = typeof db;

export const getDB = (tx: DB) => {
    if (!tx) {
        return db;
    }

    return tx;
};
