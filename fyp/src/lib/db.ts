import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@/drizzle/schema";

const dbUrl =
    process.env.DATABASE_URL ||
    "mysql://opti:optipass@localhost:3306/optischeduling";

// Create a connection synchronously (no await)
const connection = mysql.createPool(dbUrl);

// Export the db instance
export const db = drizzle(connection, { schema, mode: "default" });
