const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "bicho-mania.db"));
db.pragma("foreign_keys = ON");

app.use(express.json());
app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.use(express.static(path.join(__dirname, "public")));

const defaultServices = [
    [
        "Banho",
        "Higiene completa com produtos adequados ao tipo de pelagem.",
        55,
        60,
    ],
    ["Tosa", "Tosa higiênica ou estética com acabamento cuidadoso.", 75, 90],
    [
        "Banho + Tosa",
        "O cuidado completo para deixar seu pet renovado.",
        110,
        120,
    ],
    [
        "Consulta veterinária",
        "Atendimento clínico com profissional parceiro.",
        150,
        45,
    ],
    ["Vacinação", "Aplicação de vacinas com orientação veterinária.", 95, 30],
    ["Corte de unhas", "Corte seguro e delicado para cães e gatos.", 25, 20],
    ["Higienização", "Limpeza de ouvidos, olhos e região íntima.", 35, 30],
    [
        "Outros serviços",
        "Conte para nós o que seu melhor amigo precisa.",
        40,
        30,
    ],
];

function initDatabase() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, duration INTEGER NOT NULL, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pets (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, name TEXT NOT NULL, species TEXT NOT NULL, breed TEXT, age TEXT, notes TEXT, FOREIGN KEY(customer_id) REFERENCES customers(id));
    CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, pet_id INTEGER NOT NULL, service_id INTEGER NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, notes TEXT, status TEXT DEFAULT 'confirmed', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(date, time), FOREIGN KEY(customer_id) REFERENCES customers(id), FOREIGN KEY(pet_id) REFERENCES pets(id), FOREIGN KEY(service_id) REFERENCES services(id));
    CREATE TABLE IF NOT EXISTS blocked_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL, UNIQUE(date, time));
    CREATE TABLE IF NOT EXISTS blocked_ranges (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, reason TEXT DEFAULT '', UNIQUE(date, start_time, end_time));
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
  `);
    const serviceColumns = db
        .prepare("PRAGMA table_info(services)")
        .all()
        .map((column) => column.name);
    if (!serviceColumns.includes("active")) {
        db.exec("ALTER TABLE services ADD COLUMN active INTEGER DEFAULT 1");
    }
    if (
        db.prepare("SELECT COUNT(*) AS count FROM services").get().count === 0
    ) {
        const insert = db.prepare(
            "INSERT INTO services (name, description, price, duration) VALUES (?, ?, ?, ?)",
        );
        const addDefaults = db.transaction(() =>
            defaultServices.forEach((service) => insert.run(...service)),
        );
        addDefaults();
    }
    if (
        db.prepare("SELECT COUNT(*) AS count FROM settings").get().count === 0
    ) {
        const insertSetting = db.prepare(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
        );
        [
            ["open", "08:00"],
            ["close", "18:00"],
            ["interval", "30"],
            ["days", "1,2,3,4,5,6"],
            ["shop_name", "Bicho Mania"],
            ["shop_phone", "(49) 3555-4422"],
        ].forEach((item) => insertSetting.run(...item));
    }
    if (db.prepare("SELECT COUNT(*) AS count FROM admins").get().count === 0) {
        db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run(
            "admin",
            "bichomania",
        );
    }
}
initDatabase();

const sessions = new Set();
const settings = () =>
    Object.fromEntries(
        db
            .prepare("SELECT key, value FROM settings")
            .all()
            .map((row) => [row.key, row.value]),
    );
const requireAuth = (req, res, next) => {
    if (!sessions.has(req.headers.authorization?.replace("Bearer ", "")))
        return res.status(401).json({ error: "Não autorizado." });
    next();
};

app.get("/api/bootstrap", (req, res) => {
    res.json({
        services: db
            .prepare("SELECT * FROM services WHERE active = 1 ORDER BY id")
            .all(),
        settings: settings(),
    });
});

app.get("/api/availability", (req, res) => {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
        return res.status(400).json({ error: "Data inválida." });
    const config = settings();
    const day = new Date(`${date}T12:00:00`).getDay();
    const allowedDays = config.days.split(",").map(Number);
    const slots = [];
    if (!allowedDays.includes(day))
        return res.json({ slots: [], closed: true });
    const occupied = new Set(
        db
            .prepare(
                "SELECT time FROM appointments WHERE date = ? AND status != 'cancelled' UNION SELECT time FROM blocked_slots WHERE date = ?",
            )
            .all(date, date)
            .map((row) => row.time),
    );
    const blockedRanges = db
        .prepare(
            "SELECT start_time, end_time FROM blocked_ranges WHERE date = ?",
        )
        .all(date)
        .map((range) => ({
            start: range.start_time,
            end: range.end_time,
        }));
    const [openHour, openMinute] = config.open.split(":").map(Number);
    const [closeHour, closeMinute] = config.close.split(":").map(Number);
    for (
        let minutes = openHour * 60 + openMinute;
        minutes < closeHour * 60 + closeMinute;
        minutes += Number(config.interval)
    ) {
        const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        const inBlockedRange = blockedRanges.some(
            (range) => time >= range.start && time < range.end,
        );
        slots.push({
            time,
            available: !occupied.has(time) && !inBlockedRange,
        });
    }
    res.json({ slots, closed: false });
});

app.post("/api/appointments", (req, res) => {
    const {
        customerName,
        phone,
        petName,
        species,
        breed,
        age,
        petNotes,
        serviceId,
        date,
        time,
        notes,
    } = req.body;
    if (
        !customerName ||
        !phone ||
        !petName ||
        !species ||
        !serviceId ||
        !date ||
        !time
    )
        return res
            .status(400)
            .json({ error: "Preencha os campos obrigatórios." });
    if (!/^[1-9]{2}9[0-9]{8}$/.test(String(phone).replace(/\D/g, "")))
        return res
            .status(400)
            .json({ error: "Informe um telefone celular válido." });
    const blocked = db
        .prepare(
            "SELECT 1 FROM blocked_slots WHERE date = ? AND time = ? UNION SELECT 1 FROM blocked_ranges WHERE date = ? AND start_time <= ? AND end_time > ? LIMIT 1",
        )
        .get(date, time, date, time, time);
    if (blocked)
        return res
            .status(409)
            .json({ error: "Esse horário está bloqueado. Escolha outro." });
    try {
        const create = db.transaction(() => {
            const customer = db
                .prepare("INSERT INTO customers (name, phone) VALUES (?, ?)")
                .run(customerName.trim(), phone.trim());
            const pet = db
                .prepare(
                    "INSERT INTO pets (customer_id, name, species, breed, age, notes) VALUES (?, ?, ?, ?, ?, ?)",
                )
                .run(
                    customer.lastInsertRowid,
                    petName.trim(),
                    species,
                    breed || "",
                    age || "",
                    petNotes || "",
                );
            const appointment = db
                .prepare(
                    "INSERT INTO appointments (customer_id, pet_id, service_id, date, time, notes) VALUES (?, ?, ?, ?, ?, ?)",
                )
                .run(
                    customer.lastInsertRowid,
                    pet.lastInsertRowid,
                    serviceId,
                    date,
                    time,
                    notes || "",
                );
            return appointment.lastInsertRowid;
        });
        const id = create();
        res.status(201).json({
            id,
            message: "Agendamento realizado com sucesso!",
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
            return res.status(409).json({
                error: "Esse horário acabou de ser reservado. Escolha outro.",
            });
        res.status(500).json({
            error: "Não foi possível salvar o agendamento.",
        });
    }
});

app.post("/api/admin/login", (req, res) => {
    const admin = db
        .prepare("SELECT * FROM admins WHERE username = ? AND password = ?")
        .get(req.body.username, req.body.password);
    if (!admin)
        return res.status(401).json({ error: "Usuário ou senha inválidos." });
    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    res.json({ token, username: admin.username });
});

app.get("/api/admin/appointments", requireAuth, (req, res) => {
    const query = `SELECT a.*, c.name AS customer_name, c.phone, p.name AS pet_name, p.species, p.breed, p.age, p.notes AS pet_notes, s.name AS service_name, s.price FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN pets p ON p.id = a.pet_id JOIN services s ON s.id = a.service_id ORDER BY a.date, a.time`;
    res.json(db.prepare(query).all());
});

app.patch("/api/admin/appointments/:id/cancel", requireAuth, (req, res) => {
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(
        req.params.id,
    );
    res.json({ ok: true });
});

app.delete("/api/admin/cancelled-appointments", requireAuth, (req, res) => {
    const result = db
        .prepare("DELETE FROM appointments WHERE status = 'cancelled'")
        .run();
    res.json({ deleted: result.changes });
});

app.get("/api/admin/blocks", requireAuth, (req, res) => {
    const ranges = db
        .prepare(
            "SELECT id, 'range' AS kind, date, start_time, end_time, reason FROM blocked_ranges ORDER BY date, start_time",
        )
        .all();
    const slots = db
        .prepare(
            "SELECT id, 'slot' AS kind, date, time AS start_time, time AS end_time, '' AS reason FROM blocked_slots ORDER BY date, time",
        )
        .all();
    res.json({ blocks: [...ranges, ...slots] });
});

app.patch(
    "/api/admin/blocks/:kind/:id/reopen",
    requireAuth,
    (req, res) => {
        const { kind, id } = req.params;
        const table = kind === "range" ? "blocked_ranges" : kind === "slot" ? "blocked_slots" : null;
        if (!table) return res.status(400).json({ error: "Bloqueio inválido." });
        const block = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
        if (!block) return res.status(404).json({ error: "Horário não encontrado." });
        const conflict =
            kind === "range"
                ? db
                      .prepare(
                          "SELECT 1 FROM appointments WHERE date = ? AND time >= ? AND time < ? AND status != 'cancelled' LIMIT 1",
                      )
                      .get(block.date, block.start_time, block.end_time)
                : db
                      .prepare(
                          "SELECT 1 FROM appointments WHERE date = ? AND time = ? AND status != 'cancelled' LIMIT 1",
                      )
                      .get(block.date, block.time);
        if (conflict)
            return res.status(409).json({
                error: "Esse bloqueio possui um agendamento confirmado.",
            });
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
        res.json({ ok: true });
    },
);

app.post("/api/admin/blocks", requireAuth, (req, res) => {
    const { date, startTime, endTime, reason = "" } = req.body;
    if (!date || !startTime || !endTime)
        return res
            .status(400)
            .json({ error: "Informe a data, o horário inicial e o horário final." });
    if (startTime >= endTime)
        return res
            .status(400)
            .json({ error: "O horário final deve ser maior que o inicial." });
    try {
        db.prepare(
            "INSERT INTO blocked_ranges (date, start_time, end_time, reason) VALUES (?, ?, ?, ?)",
        ).run(date, startTime, endTime, reason.trim());
        res.status(201).json({ ok: true });
    } catch {
        res.status(409).json({ error: "Esse período já está bloqueado." });
    }
});

app.put("/api/admin/settings", requireAuth, (req, res) => {
    const update = db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );
    const save = db.transaction(() =>
        Object.entries(req.body).forEach(([key, value]) =>
            update.run(key, String(value)),
        ),
    );
    save();
    res.json({ settings: settings() });
});

app.post("/api/admin/services", requireAuth, (req, res) => {
    const { name, description, price, duration } = req.body;
    if (!name?.trim() || !description?.trim() || !Number.isFinite(Number(price)) || Number(duration) <= 0)
        return res.status(400).json({ error: "Preencha os dados do serviço." });
    const result = db
        .prepare(
            "INSERT INTO services (name, description, price, duration) VALUES (?, ?, ?, ?)",
        )
        .run(name.trim(), description.trim(), Number(price), Number(duration));
    res.status(201).json({ id: result.lastInsertRowid });
});

app.get("/api/admin/services", requireAuth, (req, res) => {
    res.json({ services: db.prepare("SELECT * FROM services ORDER BY id").all() });
});

app.put("/api/admin/services/:id", requireAuth, (req, res) => {
    const { name, description, price, duration, active } = req.body;
    if (!name?.trim() || !description?.trim() || !Number.isFinite(Number(price)) || Number(duration) <= 0)
        return res.status(400).json({ error: "Preencha os dados do serviço." });
    const result = db
        .prepare(
            "UPDATE services SET name = ?, description = ?, price = ?, duration = ?, active = ? WHERE id = ?",
        )
        .run(
            name.trim(),
            description.trim(),
            Number(price),
            Number(duration),
            active === false || active === 0 ? 0 : 1,
            req.params.id,
        );
    if (!result.changes)
        return res.status(404).json({ error: "Serviço não encontrado." });
    res.json({ ok: true });
});

app.delete("/api/admin/services/:id", requireAuth, (req, res) => {
    const service = db.prepare("SELECT id FROM services WHERE id = ?").get(req.params.id);
    if (!service) return res.status(404).json({ error: "Serviço não encontrado." });
    const references = db
        .prepare("SELECT 1 FROM appointments WHERE service_id = ? LIMIT 1")
        .get(req.params.id);
    if (references) {
        db.prepare("UPDATE services SET active = 0 WHERE id = ?").run(req.params.id);
        return res.json({ ok: true, deactivated: true });
    }
    db.prepare("DELETE FROM services WHERE id = ?").run(req.params.id);
    res.json({ ok: true, deleted: true });
});

app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.listen(port, () =>
    console.log(`Bicho Mania rodando em http://localhost:${port}`),
);
