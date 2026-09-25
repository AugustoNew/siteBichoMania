const state = {
    services: [],
    settings: {},
    selectedService: null,
    selectedDate: "",
    selectedTime: "",
    token: localStorage.getItem("bichoAdminToken"),
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) =>
    Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
const dateBR = (value) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const escapeHtml = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

async function api(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Ocorreu um erro.");
    return data;
}

async function loadPublic() {
    const data = await api("/api/bootstrap");
    state.services = data.services;
    state.settings = data.settings;
    const cards = $("#services-grid");
    const icons = ["🛁", "✂️", "🧼", "🩺", "💉", "🐾", "✨", "💚"];
    cards.innerHTML = state.services
        .map(
            (service, index) =>
                `<article class="service-card"><div class="service-icon">${icons[index % icons.length]}</div><h3>${service.name}</h3><p>${service.description}</p><div class="service-meta"><span>${service.duration} min</span><strong class="service-price">${money(service.price)}</strong></div><button class="button" data-service="${service.id}">Agendar <span>↗</span></button></article>`,
        )
        .join("");
    $("#service-options").innerHTML = state.services
        .map(
            (service, index) =>
                `<label class="service-option"><span><h4>${service.name}</h4><small>${service.duration} min · ${money(service.price)}</small></span><input type="radio" name="serviceId" value="${service.id}" ${index === 0 ? "checked" : ""}></label>`,
        )
        .join("");
    $$(".service-option").forEach((option) =>
        option.addEventListener("click", () => {
            $$(".service-option").forEach((item) =>
                item.classList.remove("selected"),
            );
            option.classList.add("selected");
            option.querySelector("input").checked = true;
        }),
    );
    $(".service-option")?.classList.add("selected");
}

function goToBooking() {
    window.location.href = "/booking.html";
}
$$("[data-scroll-booking]").forEach((button) =>
    button.addEventListener("click", goToBooking),
);
$$('a[href="#agendamento"]').forEach((link) => (link.href = "/booking.html"));
$("#services-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-service]");
    if (!button) return;
    const input = $(`input[value="${button.dataset.service}"]`);
    if (input) {
        input.checked = true;
        $$(".service-option").forEach((item) =>
            item.classList.toggle("selected", item.contains(input)),
        );
    }
    goToBooking();
});
$(".menu-toggle").addEventListener("click", () =>
    $(".nav-links").classList.toggle("mobile-open"),
);

function showStep(step) {
    $$(".form-step").forEach((item) =>
        item.classList.toggle("active", item.dataset.step === String(step)),
    );
    $$(".form-progress span").forEach((item, index) =>
        item.classList.toggle("active", index < step),
    );
}
$$(".next-step").forEach((button) =>
    button.addEventListener("click", async () => {
        const current = Number($(".form-step.active").dataset.step);
        if (current === 1) {
            state.selectedService = Number(
                $('input[name="serviceId"]:checked').value,
            );
            showStep(2);
        } else if (current === 2) {
            if (!state.selectedDate || !state.selectedTime)
                return alert("Escolha uma data e um horário disponível.");
            showStep(3);
        }
    }),
);
$$(".prev-step").forEach((button) =>
    button.addEventListener("click", () =>
        showStep(Number($(".form-step.active").dataset.step) - 1),
    ),
);
$("#booking-date").min = new Date().toISOString().split("T")[0];
$("#booking-date").addEventListener("change", async (event) => {
    state.selectedDate = event.target.value;
    state.selectedTime = "";
    const availability = $("#availability");
    availability.innerHTML =
        '<span class="muted">Carregando horários...</span>';
    const data = await api(`/api/availability?date=${state.selectedDate}`);
    if (data.closed) {
        availability.innerHTML =
            '<p class="closed-note">Não abrimos neste dia. Escolha outra data.</p>';
        return;
    }
    availability.innerHTML = data.slots
        .map(
            (slot) =>
                `<button type="button" class="time-slot ${slot.available ? "" : "occupied"}" ${slot.available ? "" : "disabled"} data-time="${slot.time}">${slot.time} ${slot.available ? "" : "· Ocupado"}</button>`,
        )
        .join("");
    $$(".time-slot").forEach((button) =>
        button.addEventListener("click", () => {
            $$(".time-slot").forEach((item) =>
                item.classList.remove("selected"),
            );
            button.classList.add("selected");
            state.selectedTime = button.dataset.time;
        }),
    );
});
$("#booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
        await api("/api/appointments", {
            method: "POST",
            body: JSON.stringify({
                customerName: form.get("customerName"),
                phone: form.get("phone"),
                petName: form.get("petName"),
                species: form.get("species"),
                breed: form.get("breed"),
                age: form.get("age"),
                petNotes: form.get("petNotes"),
                notes: form.get("notes"),
                serviceId: state.selectedService,
                date: state.selectedDate,
                time: state.selectedTime,
            }),
        });
        const service = state.services.find(
            (item) => item.id === state.selectedService,
        );
        $("#booking-form").hidden = true;
        $(".booking-intro").hidden = true;
        $("#success-view").hidden = false;
        const values = {
            Cliente: form.get("customerName"),
            Pet: form.get("petName"),
            Serviço: service.name,
            Data: dateBR(state.selectedDate),
            Horário: state.selectedTime,
            Telefone: form.get("phone"),
        };
        $("#confirmation").innerHTML = Object.entries(values)
            .map(
                ([label, value]) =>
                    `<div><span>${label}</span><b>${value}</b></div>`,
            )
            .join("");
        const message = `Olá, Bicho Mania! Meu agendamento foi confirmado.%0A%0ACliente: ${values.Cliente}%0APet: ${values.Pet}%0AServiço: ${values.Serviço}%0AData: ${values.Data}%0AHorário: ${values.Horário}%0ATelefone: ${values.Telefone}`;
        $("#whatsapp-link").href = `https://wa.me/554935554422?text=${message}`;
    } catch (error) {
        alert(error.message);
    }
});
$(".new-booking").addEventListener("click", () => window.location.reload());

function openAdmin() {
    $("#admin-modal").hidden = false;
    $("#admin-login").hidden = false;
    $("#admin-dashboard").hidden = true;
}
$$("[data-admin-open]").forEach((button) =>
    button.addEventListener("click", openAdmin),
);
$(".modal-close").addEventListener(
    "click",
    () => ($("#admin-modal").hidden = true),
);
$(".modal-backdrop").addEventListener(
    "click",
    () => ($("#admin-modal").hidden = true),
);
$("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
        const result = await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({
                username: data.get("username"),
                password: data.get("password"),
            }),
        });
        state.token = result.token;
        localStorage.setItem("bichoAdminToken", state.token);
        loadDashboard();
    } catch (error) {
        alert(error.message);
    }
});
async function loadDashboard() {
    try {
        const appointments = await api("/api/admin/appointments");
        $("#admin-login").hidden = true;
        $("#admin-dashboard").hidden = false;
        const active = appointments.filter(
            (item) => item.status !== "cancelled",
        );
        $("#admin-stats").innerHTML =
            `<div class="admin-stat"><strong>${active.length}</strong><span>agendamentos ativos</span></div><div class="admin-stat"><strong>${active.filter((item) => item.date === new Date().toISOString().split("T")[0]).length}</strong><span>para hoje</span></div><div class="admin-stat"><strong>${new Set(active.map((item) => item.date)).size}</strong><span>dias na agenda</span></div>`;
        renderAppointments(appointments);
        await renderSettings();
    } catch {
        state.token = null;
        localStorage.removeItem("bichoAdminToken");
        $("#admin-login").hidden = false;
        $("#admin-dashboard").hidden = true;
    }
}
function renderAppointments(items) {
    const cancelled = items.filter((item) => item.status === "cancelled");
    const grouped = items.reduce((result, item) => {
        (result[item.date] ||= []).push(item);
        return result;
    }, {});
    $("#admin-agenda").innerHTML = `<div class="admin-history-actions"><button class="button button-ghost" data-clear-history ${cancelled.length ? "" : "disabled"}>Limpar histórico</button></div>${
        Object.keys(grouped).length
            ? Object.entries(grouped)
                  .map(
                      ([date, rows]) =>
                          `<div class="agenda-day"><h3>${dateBR(date)}</h3>${rows.map((item) => `<div class="appointment-row ${item.status === "cancelled" ? "status-cancelled" : ""}"><span class="date">${item.time}</span><span class="pet">${escapeHtml(item.pet_name)}<small>${escapeHtml(item.species)} · ${escapeHtml(item.customer_name)}</small></span><span class="service">${escapeHtml(item.service_name)}<small>${escapeHtml(item.phone)}</small></span><span>${item.status === "cancelled" ? "Cancelado" : money(item.price)}</span>${item.status === "cancelled" ? "" : `<button class="cancel-btn" data-cancel="${item.id}">Cancelar</button>`}</div>`).join("")}</div>`,
                  )
                  .join("")
            : '<p class="muted">Nenhum agendamento registrado ainda.</p>'
    }`;
    $("[data-clear-history]").addEventListener("click", async () => {
        if (!confirm("Tem certeza que deseja limpar o histórico de cancelamentos?")) return;
        await api("/api/admin/cancelled-appointments", { method: "DELETE" });
        await loadDashboard();
    });
    $$("#admin-agenda [data-cancel]").forEach((button) =>
        button.addEventListener("click", async () => {
            if (confirm("Cancelar este agendamento?")) {
                await api(
                    `/api/admin/appointments/${button.dataset.cancel}/cancel`,
                    {
                        method: "PATCH",
                    },
                );
                loadDashboard();
            }
        }),
    );
}
async function renderSettings() {
    const config = state.settings;
    $("#settings-form").innerHTML =
        `<label>Abertura<input name="open" value="${config.open}"></label><label>Fechamento<input name="close" value="${config.close}"></label><label>Intervalo (min)<input name="interval" type="number" value="${config.interval}"></label><label>Dias (0=dom, 6=sáb)<input name="days" value="${config.days}"></label><label>Nome do pet shop<input name="shop_name" value="${config.shop_name}"></label><label>Telefone<input name="shop_phone" value="${config.shop_phone}"></label><button class="button" type="submit">Salvar configurações</button>`;
    const [{ blocks }, { services }] = await Promise.all([
        api("/api/admin/blocks"),
        api("/api/admin/services"),
    ]);
    $("#admin-config-tools").innerHTML = `<div class="admin-add"><h3>Bloquear horários</h3><form id="block-form" class="input-grid"><input name="date" type="date" required><input name="startTime" type="time" required><input name="endTime" type="time" required><input name="reason" placeholder="Motivo (opcional)"><button class="button" type="submit">Bloquear período</button></form></div><div class="admin-add"><h3>Horários bloqueados</h3><div class="blocked-list">${blocks.length ? blocks.map((block) => `<div class="blocked-row"><span><strong>${dateBR(block.date)}</strong> · ${block.start_time}${block.end_time !== block.start_time ? ` às ${block.end_time}` : ""}${block.reason ? `<small>${escapeHtml(block.reason)}</small>` : ""}</span><button class="button button-small button-ghost" data-reopen-block="${block.kind}:${block.id}">Reabrir horário</button></div>`).join("") : '<p class="muted">Nenhum horário bloqueado.</p>'}</div></div>`;
    $("#service-list").innerHTML = services.length
        ? `<div class="service-admin-heading" role="row"><span role="columnheader">Nome</span><span role="columnheader">Descrição</span><span role="columnheader">Preço (R$)</span><span role="columnheader">Duração (min)</span><span role="columnheader">Status</span><span role="columnheader">Ação</span><span></span></div>${services
              .map(
                  (service) =>
                      `<form class="service-admin-row" data-service-form="${service.id}"><label class="service-field"><span>Nome</span><input name="name" aria-label="Nome" value="${escapeHtml(service.name)}" required></label><label class="service-field"><span>Descrição</span><input name="description" aria-label="Descrição" value="${escapeHtml(service.description)}" required></label><label class="service-field"><span>Preço (R$)</span><input name="price" aria-label="Preço" type="number" min="0" step="0.01" value="${service.price}" required></label><label class="service-field"><span>Duração (min)</span><input name="duration" aria-label="Duração" type="number" min="1" value="${service.duration}" required></label><label class="service-field"><span>Status</span><select name="active" aria-label="Status"><option value="1" ${service.active ? "selected" : ""}>Ativo</option><option value="0" ${service.active ? "" : "selected"}>Inativo</option></select></label><button class="button button-small" type="submit">Salvar</button><button class="cancel-btn" type="button" data-delete-service="${service.id}">Excluir</button></form>`,
              )
              .join("")}`
        : '<p class="muted">Nenhum serviço cadastrado.</p>';
    $("#block-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target));
        try {
            await api("/api/admin/blocks", {
                method: "POST",
                body: JSON.stringify(data),
            });
            event.target.reset();
            await renderSettings();
            alert("Período bloqueado.");
        } catch (error) {
            alert(error.message);
        }
    });
    $$('[data-reopen-block]').forEach((button) =>
        button.addEventListener("click", async () => {
            const [kind, id] = button.dataset.reopenBlock.split(":");
            try {
                await api(`/api/admin/blocks/${kind}/${id}/reopen`, {
                    method: "PATCH",
                });
                await renderSettings();
            } catch (error) {
                alert(error.message);
            }
        }),
    );
    $$('[data-service-form]').forEach((form) =>
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            data.active = data.active === "1";
            try {
                await api(`/api/admin/services/${form.dataset.serviceForm}`, {
                    method: "PUT",
                    body: JSON.stringify(data),
                });
                await loadDashboard();
                await loadPublic();
            } catch (error) {
                alert(error.message);
            }
        }),
    );
    $$('[data-delete-service]').forEach((button) =>
        button.addEventListener("click", async () => {
            if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
            try {
                await api(`/api/admin/services/${button.dataset.deleteService}`, {
                    method: "DELETE",
                });
                await loadDashboard();
                await loadPublic();
            } catch (error) {
                alert(error.message);
            }
        }),
    );
}
$("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(data),
    });
    alert("Configurações salvas.");
});
$("#service-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    await api("/api/admin/services", {
        method: "POST",
        body: JSON.stringify(data),
    });
    event.target.reset();
    alert("Serviço cadastrado.");
    await loadDashboard();
    await loadPublic();
});
$$("[data-admin-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
        $$("[data-admin-tab]").forEach((item) =>
            item.classList.remove("active"),
        );
        tab.classList.add("active");
        $("#admin-agenda").hidden = tab.dataset.adminTab !== "agenda";
        $("#admin-config").hidden = tab.dataset.adminTab !== "config";
    }),
);
$("#admin-logout").addEventListener("click", () => {
    state.token = null;
    localStorage.removeItem("bichoAdminToken");
    $("#admin-modal").hidden = true;
});
loadPublic();
