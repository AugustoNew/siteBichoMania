const booking = JSON.parse(sessionStorage.getItem("bichoBooking") || "null");
const money = (value) =>
    Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
const dateBR = (value) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

if (!booking) {
    window.location.href = "/booking.html";
} else {
    document.querySelector("#summary").innerHTML =
        `<div><span>Serviço</span><b>${booking.serviceName}</b></div><div><span>Data e horário</span><b>${dateBR(booking.date)} às ${booking.time}</b></div><div><span>Responsável</span><b>${booking.customerName}</b></div><div><span>Animal</span><b>${booking.petName} · ${booking.species}</b></div><div><span>Total</span><b>${money(booking.price)}</b></div>`;
    document
        .querySelector("#payment-form")
        .addEventListener("submit", async (event) => {
            event.preventDefault();
            const method = new FormData(event.target).get("paymentMethod");
            const response = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...booking, paymentMethod: method }),
            });
            const data = await response.json();
            if (!response.ok)
                return alert(
                    data.error || "Não foi possível confirmar o agendamento.",
                );
            sessionStorage.setItem(
                "bichoConfirmation",
                JSON.stringify({
                    ...booking,
                    id: data.id,
                    paymentMethod: method,
                }),
            );
            sessionStorage.removeItem("bichoBooking");
            window.location.href = "/confirmation.html";
        });
}
