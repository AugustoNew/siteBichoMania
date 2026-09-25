const booking = JSON.parse(
    sessionStorage.getItem("bichoConfirmation") || "null",
);
const dateBR = (value) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

if (!booking) {
    window.location.href = "/booking.html";
} else {
    document.querySelector("#confirmation").innerHTML =
        `<div><span>Serviço</span><b>${booking.serviceName}</b></div><div><span>Data e horário</span><b>${dateBR(booking.date)} às ${booking.time}</b></div><div><span>Responsável</span><b>${booking.customerName}</b></div><div><span>Animal</span><b>${booking.petName} · ${booking.species}</b></div>`;
    const message = `Olá, Bicho Mania! Meu agendamento foi confirmado.%0A%0AServiço: ${booking.serviceName}%0AData: ${dateBR(booking.date)}%0AHorário: ${booking.time}%0AResponsável: ${booking.customerName}%0APet: ${booking.petName}%0ATelefone: ${booking.phone}`;
    document.querySelector("#whatsapp-link").href =
        `https://wa.me/554935554422?text=${message}`;
}
