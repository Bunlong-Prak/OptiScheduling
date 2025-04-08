import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@/drizzle/schema";

// Create a connection synchronously (no await)
const connection = mysql.createPool(process.env.DATABASE_URL!);

// Export the db instance
export const db = drizzle(connection, { schema, mode: "default" });
