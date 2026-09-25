const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { db, initDatabase } = require("./database");

const app = express();
const port = process.env.PORT || 3000;
const databaseReady = initDatabase();

app.use(express.json());
app.use(async (_req, _res, next) => {
    try {
        await databaseReady;
        next();
    } catch (error) {
        next(error);
    }
});
app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.use(express.static(path.join(__dirname, "public")));

const sessionSecret = process.env.ADMIN_SESSION_SECRET || "bicho-mania-session-secret";
const settings = async () =>
    Object.fromEntries(
        (await db.prepare("SELECT key, value FROM settings").all()).map((row) => [row.key, row.value]),
    );
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const [username, signature] = token?.split(".") || [];
    const expected = username
        ? crypto.createHmac("sha256", sessionSecret).update(username).digest("hex")
        : "";
    if (
        !username ||
        !signature ||
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
        return res.status(401).json({ error: "Não autorizado." });
    next();
};

app.get("/api/bootstrap", async (req, res) => {
    res.json({
        services: await db
            .prepare("SELECT * FROM services WHERE active = 1 ORDER BY id")
            .all(),
        settings: await settings(),
    });
});

app.get("/api/availability", async (req, res) => {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
        return res.status(400).json({ error: "Data inválida." });
    const config = await settings();
    const day = new Date(`${date}T12:00:00`).getDay();
    const allowedDays = config.days.split(",").map(Number);
    const slots = [];
    if (!allowedDays.includes(day))
        return res.json({ slots: [], closed: true });
    const occupied = new Set(
        (await db
            .prepare(
                "SELECT time FROM appointments WHERE date = ? AND status != 'cancelled' UNION SELECT time FROM blocked_slots WHERE date = ?",
            )
            .all(date, date))
            .map((row) => row.time),
    );
    const blockedRanges = (await db
        .prepare(
            "SELECT start_time, end_time FROM blocked_ranges WHERE date = ?",
        )
        .all(date))
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

app.post("/api/appointments", async (req, res) => {
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
    const blocked = await db
        .prepare(
            "SELECT 1 FROM blocked_slots WHERE date = ? AND time = ? UNION SELECT 1 FROM blocked_ranges WHERE date = ? AND start_time <= ? AND end_time > ? LIMIT 1",
        )
        .get(date, time, date, time, time);
    if (blocked)
        return res
            .status(409)
            .json({ error: "Esse horário está bloqueado. Escolha outro." });
    try {
        const id = await db.transaction(async () => {
            const customer = await db
                .prepare("INSERT INTO customers (name, phone) VALUES (?, ?)")
                .run(customerName.trim(), phone.trim());
            const pet = await db
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
            const appointment = await db
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

app.post("/api/admin/login", async (req, res) => {
    const admin = await db
        .prepare("SELECT * FROM admins WHERE username = ? AND password = ?")
        .get(req.body.username, req.body.password);
    if (!admin)
        return res.status(401).json({ error: "Usuário ou senha inválidos." });
    const token = `${admin.username}.${crypto
        .createHmac("sha256", sessionSecret)
        .update(admin.username)
        .digest("hex")}`;
    res.json({ token, username: admin.username });
});

app.get("/api/admin/appointments", requireAuth, async (req, res) => {
    const query = `SELECT a.*, c.name AS customer_name, c.phone, p.name AS pet_name, p.species, p.breed, p.age, p.notes AS pet_notes, s.name AS service_name, s.price FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN pets p ON p.id = a.pet_id JOIN services s ON s.id = a.service_id ORDER BY a.date, a.time`;
    res.json(await db.prepare(query).all());
});

app.patch("/api/admin/appointments/:id/cancel", requireAuth, async (req, res) => {
    await db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(
        req.params.id,
    );
    res.json({ ok: true });
});

app.delete("/api/admin/cancelled-appointments", requireAuth, async (req, res) => {
    const result = await db
        .prepare("DELETE FROM appointments WHERE status = 'cancelled'")
        .run();
    res.json({ deleted: result.changes });
});

app.get("/api/admin/blocks", requireAuth, async (req, res) => {
    const ranges = await db
        .prepare(
            "SELECT id, 'range' AS kind, date, start_time, end_time, reason FROM blocked_ranges ORDER BY date, start_time",
        )
        .all();
    const slots = await db
        .prepare(
            "SELECT id, 'slot' AS kind, date, time AS start_time, time AS end_time, '' AS reason FROM blocked_slots ORDER BY date, time",
        )
        .all();
    res.json({ blocks: [...ranges, ...slots] });
});

app.patch(
    "/api/admin/blocks/:kind/:id/reopen",
    requireAuth,
    async (req, res) => {
        const { kind, id } = req.params;
        const table = kind === "range" ? "blocked_ranges" : kind === "slot" ? "blocked_slots" : null;
        if (!table) return res.status(400).json({ error: "Bloqueio inválido." });
        const block = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
        if (!block) return res.status(404).json({ error: "Horário não encontrado." });
        const conflict =
            kind === "range"
                ? await db
                      .prepare(
                          "SELECT 1 FROM appointments WHERE date = ? AND time >= ? AND time < ? AND status != 'cancelled' LIMIT 1",
                      )
                      .get(block.date, block.start_time, block.end_time)
                : await db
                      .prepare(
                          "SELECT 1 FROM appointments WHERE date = ? AND time = ? AND status != 'cancelled' LIMIT 1",
                      )
                      .get(block.date, block.time);
        if (conflict)
            return res.status(409).json({
                error: "Esse bloqueio possui um agendamento confirmado.",
            });
        await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
        res.json({ ok: true });
    },
);

app.post("/api/admin/blocks", requireAuth, async (req, res) => {
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
        await db.prepare(
            "INSERT INTO blocked_ranges (date, start_time, end_time, reason) VALUES (?, ?, ?, ?)",
        ).run(date, startTime, endTime, reason.trim());
        res.status(201).json({ ok: true });
    } catch {
        res.status(409).json({ error: "Esse período já está bloqueado." });
    }
});

app.put("/api/admin/settings", requireAuth, async (req, res) => {
    const update = db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );
    await db.transaction(async () => {
        for (const [key, value] of Object.entries(req.body)) await update.run(key, String(value));
    });
    res.json({ settings: await settings() });
});

app.post("/api/admin/services", requireAuth, async (req, res) => {
    const { name, description, price, duration } = req.body;
    if (!name?.trim() || !description?.trim() || !Number.isFinite(Number(price)) || Number(duration) <= 0)
        return res.status(400).json({ error: "Preencha os dados do serviço." });
    const result = await db
        .prepare(
            "INSERT INTO services (name, description, price, duration) VALUES (?, ?, ?, ?)",
        )
        .run(name.trim(), description.trim(), Number(price), Number(duration));
    res.status(201).json({ id: result.lastInsertRowid });
});

app.get("/api/admin/services", requireAuth, async (req, res) => {
    res.json({ services: await db.prepare("SELECT * FROM services ORDER BY id").all() });
});

app.put("/api/admin/services/:id", requireAuth, async (req, res) => {
    const { name, description, price, duration, active } = req.body;
    if (!name?.trim() || !description?.trim() || !Number.isFinite(Number(price)) || Number(duration) <= 0)
        return res.status(400).json({ error: "Preencha os dados do serviço." });
    const result = await db
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

app.delete("/api/admin/services/:id", requireAuth, async (req, res) => {
    const service = await db.prepare("SELECT id FROM services WHERE id = ?").get(req.params.id);
    if (!service) return res.status(404).json({ error: "Serviço não encontrado." });
    const references = await db
        .prepare("SELECT 1 FROM appointments WHERE service_id = ? LIMIT 1")
        .get(req.params.id);
    if (references) {
        await db.prepare("UPDATE services SET active = 0 WHERE id = ?").run(req.params.id);
        return res.json({ ok: true, deactivated: true });
    }
    await db.prepare("DELETE FROM services WHERE id = ?").run(req.params.id);
    res.json({ ok: true, deleted: true });
});

app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")),
);

if (require.main === module) {
    app.listen(port, () =>
        console.log(`Bicho Mania rodando em http://localhost:${port}`),
    );
}

module.exports = app;
