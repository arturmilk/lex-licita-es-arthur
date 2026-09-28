import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Em desenvolvimento o HMR reavalia este módulo a cada recompilação. Sem um cache
// global, cada recompilação abriria um pool novo e as conexões vazariam até esgotar
// o Postgres ("sorry, too many clients already") — foi o que derrubou o preview.
const globalForDb = globalThis as unknown as { __pgPool?: ReturnType<typeof postgres> };

const client = globalForDb.__pgPool ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = client;

export const db = drizzle(client, { schema });

export type DB = typeof db;
