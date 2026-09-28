// Aktuelles Jahr im Footer
document.getElementById("year").textContent = new Date().getFullYear();

// Platzhalter-Links (data-todo) warnen in der Konsole, damit sie vor dem Veröffentlichen nicht vergessen werden
document.querySelectorAll("[data-todo]").forEach((el) => {
  console.warn("Platzhalter noch ersetzen:", el.dataset.todo);
});
