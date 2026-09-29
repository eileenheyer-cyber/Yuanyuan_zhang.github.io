/* ==========================================================================
   Minimal DE/EN language toggle.

   Convention:
   - Any element with a `data-en` attribute gets its innerHTML swapped
     between the German markup already in the page and the English
     markup in `data-en`. The German version is captured into `data-de`
     the first time the page runs, so no separate DE copy needs to be
     authored anywhere.
   - The <title> element uses `data-en` too, but is handled separately
     so document.title updates correctly.
   - A <meta name="description"> (or any element) that needs its
     `content` attribute translated instead of its innerHTML uses
     `data-en-content`.
   - The toggle button (#lang-toggle) shows "DE / EN" with the current
     language highlighted; clicking it switches to the other one, and the
     choice is remembered in localStorage.
   ========================================================================== */

(() => {
  "use strict";

  const STORAGE_KEY = "site-lang-v2"; // bumped when the default changed from DE to EN

  function getPreferredLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "de" || stored === "en") return stored;
    } catch (e) {
      /* localStorage unavailable (private mode etc.) — fall through */
    }
    return "en";
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;

    // Page <title>
    const titleEl = document.querySelector("title[data-en]");
    if (titleEl) {
      if (!titleEl.dataset.de) titleEl.dataset.de = titleEl.textContent;
      const next = lang === "en" ? titleEl.dataset.en : titleEl.dataset.de;
      titleEl.textContent = next;
      document.title = next;
    }

    // Attributes (meta description, etc.)
    document.querySelectorAll("[data-en-content]").forEach((el) => {
      if (!el.dataset.deContent) el.dataset.deContent = el.getAttribute("content") || "";
      el.setAttribute("content", lang === "en" ? el.dataset.enContent : el.dataset.deContent);
    });

    // Regular content
    document.querySelectorAll("body [data-en]").forEach((el) => {
      if (!el.dataset.de) el.dataset.de = el.innerHTML;
      el.innerHTML = lang === "en" ? el.dataset.en : el.dataset.de;
    });

    // Language-specific links (e.g. CV download)
    document.querySelectorAll("[data-en-href]").forEach((el) => {
      const href = lang === "en" ? el.dataset.enHref : el.dataset.deHref;
      el.setAttribute("href", href);
      el.setAttribute("download", href.split("/").pop());
    });

    const toggle = document.getElementById("lang-toggle");
    if (toggle) {
      // Show both languages; the active (current) one is highlighted.
      toggle.innerHTML =
        '<span class="lang-opt' + (lang === "de" ? " is-active" : "") + '">DE</span>' +
        '<span class="lang-sep">/</span>' +
        '<span class="lang-opt' + (lang === "en" ? " is-active" : "") + '">EN</span>';
      toggle.setAttribute(
        "aria-label",
        lang === "en" ? "Auf Deutsch umschalten" : "Switch to English"
      );
    }

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* best effort only */
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyLang(getPreferredLang());

    const toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = document.documentElement.lang === "de" ? "de" : "en";
        applyLang(current === "en" ? "de" : "en");
      });
    }
  });
})();
