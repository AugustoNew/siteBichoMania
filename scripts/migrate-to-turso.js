const path = require("path");
const { createClient } = require("@libsql/client");
const { initDatabase } = require("../database");

const tables = [
    "services",
    "customers",
    "pets",
    "appointments",
    "blocked_slots",
    "blocked_ranges",
    "settings",
    "admins",
];

async function migrate() {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
        throw new Error("Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN antes de migrar.");
    }

    await initDatabase();
    const source = createClient({ url: `file:${path.join(__dirname, "..", "bicho-mania.db")}` });
    const destination = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    for (const table of tables) {
        const rows = (await source.execute(`SELECT * FROM ${table}`)).rows;
        if (!rows.length) continue;
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => "?").join(", ");
        const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
        await destination.batch(rows.map((row) => ({ sql, args: columns.map((column) => row[column]) })), "write");
        console.log(`${table}: ${rows.length} registro(s) processado(s)`);
    }
}

migrate().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
