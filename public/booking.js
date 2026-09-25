const bookingState = { services: [], date: "", time: "" };
const $ = (selector) => document.querySelector(selector);
const money = (value) =>
    Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

async function loadBookingData() {
    const data = await fetch("/api/bootstrap").then((response) =>
        response.json(),
    );
    bookingState.services = data.services;
    const serviceId = new URLSearchParams(window.location.search).get(
        "service",
    );
    $("#service-id").innerHTML = data.services
        .map(
            (service) =>
                `<option value="${service.id}" ${String(service.id) === serviceId ? "selected" : ""}>${service.name} · ${money(service.price)}</option>`,
        )
        .join("");
}

function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validPhone(value) {
    const digits = value.replace(/\D/g, "");
    return /^[1-9]{2}9[0-9]{8}$/.test(digits);
}

async function loadAvailability(event) {
    bookingState.date = event.target.value;
    bookingState.time = "";
    const availability = $("#availability");
    availability.innerHTML =
        '<span class="muted">Carregando horários...</span>';
    const data = await fetch(
        `/api/availability?date=${bookingState.date}`,
    ).then((response) => response.json());
    if (data.closed) {
        availability.innerHTML =
            '<p class="closed-note">Não abrimos neste dia. Escolha outra data.</p>';
        return;
    }
    availability.innerHTML = data.slots
        .map(
            (slot) =>
                `<button type="button" class="time-slot ${slot.available ? "" : "occupied"}" ${slot.available ? "" : "disabled"} data-time="${slot.time}">${slot.time}${slot.available ? "" : " · Ocupado"}</button>`,
        )
        .join("");
    availability
        .querySelectorAll(".time-slot:not(.occupied)")
        .forEach((button) =>
            button.addEventListener("click", () => {
                availability
                    .querySelectorAll(".time-slot")
                    .forEach((item) => item.classList.remove("selected"));
                button.classList.add("selected");
                bookingState.time = button.dataset.time;
            }),
        );
}

$("#phone").addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
    event.target.classList.remove("invalid");
    $("#phone-error").hidden = true;
});
$("#booking-date").min = new Date().toISOString().split("T")[0];
$("#booking-date").addEventListener("change", loadAvailability);
$("#booking-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!bookingState.date || !bookingState.time)
        return alert("Escolha uma data e um horário disponível.");
    if (!validPhone($("#phone").value)) {
        $("#phone").classList.add("invalid");
        $("#phone-error").hidden = false;
        $("#phone").focus();
        return;
    }
    const form = new FormData(event.target);
    const service = bookingState.services.find(
        (item) => String(item.id) === $("#service-id").value,
    );
    const booking = {
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        customerName: form.get("customerName"),
        phone: $("#phone").value,
        petName: form.get("petName"),
        species: form.get("species"),
        notes: form.get("notes"),
        date: bookingState.date,
        time: bookingState.time,
    };
    sessionStorage.setItem("bichoBooking", JSON.stringify(booking));
    window.location.href = "/payment.html";
});

loadBookingData().catch(() => {
    $("#service-id").innerHTML =
        '<option value="">Não foi possível carregar os serviços</option>';
});
