const path = require("path");
const { createClient } = require("@libsql/client");

const client = createClient({
    url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, "bicho-mania.db")}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = {
    prepare(sql) {
        return {
            all: (...args) => client.execute({ sql, args }).then((result) => result.rows),
            get: (...args) => client.execute({ sql, args }).then((result) => result.rows[0]),
            run: async (...args) => {
                const result = await client.execute({ sql, args });
                return {
                    changes: Number(result.rowsAffected || 0),
                    lastInsertRowid: result.lastInsertRowid == null ? undefined : Number(result.lastInsertRowid),
                };
            },
        };
    },
    async batch(statements) {
        return client.batch(statements, "write");
    },
    async transaction(callback) {
        await client.execute("BEGIN");
        try {
            const result = await callback();
            await client.execute("COMMIT");
            return result;
        } catch (error) {
            await client.execute("ROLLBACK");
            throw error;
        }
    },
};

const defaultServices = [
    ["Banho", "Higiene completa com produtos adequados ao tipo de pelagem.", 55, 60],
    ["Tosa", "Tosa higiênica ou estética com acabamento cuidadoso.", 75, 90],
    ["Banho + Tosa", "O cuidado completo para deixar seu pet renovado.", 110, 120],
    ["Consulta veterinária", "Atendimento clínico com profissional parceiro.", 150, 45],
    ["Vacinação", "Aplicação de vacinas com orientação veterinária.", 95, 30],
    ["Corte de unhas", "Corte seguro e delicado para cães e gatos.", 25, 20],
    ["Higienização", "Limpeza de ouvidos, olhos e região íntima.", 35, 30],
    ["Outros serviços", "Conte para nós o que seu melhor amigo precisa.", 40, 30],
];

async function initDatabase() {
    await client.execute("PRAGMA foreign_keys = ON");
    await db.batch([
        { sql: "CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, duration INTEGER NOT NULL, active INTEGER DEFAULT 1)" },
        { sql: "CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL)" },
        { sql: "CREATE TABLE IF NOT EXISTS pets (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, name TEXT NOT NULL, species TEXT NOT NULL, breed TEXT, age TEXT, notes TEXT, FOREIGN KEY(customer_id) REFERENCES customers(id))" },
        { sql: "CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, pet_id INTEGER NOT NULL, service_id INTEGER NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, notes TEXT, status TEXT DEFAULT 'confirmed', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(date, time), FOREIGN KEY(customer_id) REFERENCES customers(id), FOREIGN KEY(pet_id) REFERENCES pets(id), FOREIGN KEY(service_id) REFERENCES services(id))" },
        { sql: "CREATE TABLE IF NOT EXISTS blocked_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL, UNIQUE(date, time))" },
        { sql: "CREATE TABLE IF NOT EXISTS blocked_ranges (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, reason TEXT DEFAULT '', UNIQUE(date, start_time, end_time))" },
        { sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)" },
        { sql: "CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)" },
    ]);

    const serviceColumns = (await db.prepare("PRAGMA table_info(services)").all()).map((column) => column.name);
    if (!serviceColumns.includes("active")) await db.prepare("ALTER TABLE services ADD COLUMN active INTEGER DEFAULT 1").run();
    if (Number((await db.prepare("SELECT COUNT(*) AS count FROM services").get()).count) === 0) {
        for (const service of defaultServices) await db.prepare("INSERT INTO services (name, description, price, duration) VALUES (?, ?, ?, ?)").run(...service);
    }
    if (Number((await db.prepare("SELECT COUNT(*) AS count FROM settings").get()).count) === 0) {
        for (const item of [["open", "08:00"], ["close", "18:00"], ["interval", "30"], ["days", "1,2,3,4,5,6"], ["shop_name", "Bicho Mania"], ["shop_phone", "(49) 3555-4422"]]) {
            await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(...item);
        }
    }
    if (Number((await db.prepare("SELECT COUNT(*) AS count FROM admins").get()).count) === 0) {
        await db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("admin", "bichomania");
    }
}

module.exports = { db, initDatabase };
