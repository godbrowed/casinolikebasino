import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import pg from "pg"

const { Client } = pg

async function loadLocalEnv() {
  let source
  try {
    source = await fs.readFile(path.join(process.cwd(), ".env"), "utf8")
  } catch (error) {
    if (error && error.code === "ENOENT") return
    throw error
  }

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separator = line.indexOf("=")
    if (separator < 1) continue

    const name = line.slice(0, separator).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || process.env[name]) continue
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    process.env[name] = value
  }
}

await loadLocalEnv()

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run database migrations")
}

const migrationsDirectory = path.join(process.cwd(), "lib", "db", "migrations")
const migrationFiles = (await fs.readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right))

const client = new Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()
  // Only one deployment may inspect/apply the migration set at a time.
  await client.query("SELECT pg_advisory_lock(784321997)")
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_puggift_migrations" (
      "name" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `)

  const appliedResult = await client.query(
    `SELECT "name" FROM "_puggift_migrations"`,
  )
  const applied = new Set(appliedResult.rows.map((row) => row.name))
  let appliedCount = 0

  for (const file of migrationFiles) {
    if (applied.has(file)) continue

    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8")
    await client.query("BEGIN")
    try {
      // pg sends the migration as one request and PostgreSQL executes all
      // statements in the surrounding transaction.
      await client.query(sql)
      await client.query(
        `INSERT INTO "_puggift_migrations" ("name") VALUES ($1)`,
        [file],
      )
      await client.query("COMMIT")
      appliedCount += 1
      console.log(`Applied migration: ${file}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  }

  if (appliedCount === 0) {
    console.log("Database migrations are already up to date")
  }
} finally {
  await client.end().catch(() => undefined)
}
