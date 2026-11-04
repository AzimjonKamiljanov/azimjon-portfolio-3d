import projectsData from "../data/projects.json";
import { playUiClick, playUiOpen, playUiClose } from "../audio/soundscape.js";

let activeTrapCleanup = null;

function trapFocus(modalElement) {
  if (activeTrapCleanup) {
    activeTrapCleanup();
    activeTrapCleanup = null;
  }

  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    'input[type="text"]:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  function getFocusableElements() {
    return Array.from(
      modalElement.querySelectorAll(focusableSelectors.join(",")),
    ).filter(
      (el) =>
        el.offsetParent !== null &&
        window.getComputedStyle(el).visibility !== "hidden",
    );
  }

  const previousActiveElement = document.activeElement;

  function handleKeyDown(e) {
    if (e.key !== "Tab") return;

    const focusables = getFocusableElements();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }

  modalElement.addEventListener("keydown", handleKeyDown);

  setTimeout(() => {
    const searchInput = modalElement.querySelector("#catalog-search");
    if (searchInput) searchInput.focus();
    else {
      const focusables = getFocusableElements();
      if (focusables.length > 0) focusables[0].focus();
    }
  }, 50);

  activeTrapCleanup = () => {
    modalElement.removeEventListener("keydown", handleKeyDown);
    if (
      previousActiveElement &&
      typeof previousActiveElement.focus === "function"
    ) {
      previousActiveElement.focus();
    }
  };

  return activeTrapCleanup;
}

export function initCatalog({ onSelectTarget }) {
  const catalogModal = document.getElementById("catalog-modal");
  const catalogClose = document.getElementById("catalog-close");
  const searchInput = document.getElementById("catalog-search");
  const searchClear = document.getElementById("catalog-search-clear");
  const categoryButtons = document.querySelectorAll(".cat-filter-btn");
  const emptyState = document.getElementById("catalog-empty-state");
  const catalogGrid = document.getElementById("catalog-planets-grid");

  let currentLanguage = "uz";
  let currentCategory = "all";
  let searchQuery = "";
  let debounceTimer = null;

  function renderCatalog() {
    if (!catalogGrid) return;

    const lang = currentLanguage;
    const q = searchQuery.toLowerCase().trim();

    const filtered = projectsData.filter((proj) => {
      // Category check
      if (currentCategory !== "all") {
        if (!proj.categories || !proj.categories.includes(currentCategory)) {
          return false;
        }
      }

      // Search query check
      if (q) {
        const tr = proj[lang] || proj.uz;
        const title = (tr.title || "").toLowerCase();
        const subtitle = (tr.subtitle || "").toLowerCase();
        const content = (tr.content || "").toLowerCase();
        const tags = (tr.tags || []).join(" ").toLowerCase();
        const author = (proj.originalAuthor || "").toLowerCase();

        const matches =
          title.includes(q) ||
          subtitle.includes(q) ||
          content.includes(q) ||
          tags.includes(q) ||
          author.includes(q);

        if (!matches) return false;
      }

      return true;
    });

    // Group filtered projects
    const myProjects = filtered.filter((p) => p.group === "my_projects");
    const toolsAndOpenSource = filtered.filter(
      (p) => p.group === "tools_and_opensource",
    );

    if (filtered.length === 0) {
      catalogGrid.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    let html = "";

    const sectionTitles = {
      uz: {
        mine: "Mualliflik Loyihalari (Azimjon Kamiljanov)",
        tools:
          "Ishlatiladigan Vositalar & Ochiq Kodli Tizimlar (Mualliflari ko'rsatilgan)",
      },
      en: {
        mine: "Authored Projects (Azimjon Kamiljanov)",
        tools: "Used Tools & Open-Source Systems (Attributed to Authors)",
      },
      ru: {
        mine: "Авторские Проекты (Азимжон Камильджанов)",
        tools: "Используемые Инструменты и Open-Source (С указанием авторов)",
      },
    };

    const currentSectionTitles = sectionTitles[lang] || sectionTitles.uz;

    function renderCard(proj) {
      const tr = proj[lang] || proj.uz;
      const targetAttr = proj.id ? `data-target="${proj.id}"` : "";
      const cats = (proj.categories || []).join(" ");
      const authorLabel = lang === "uz" ? "Muallif" : lang === "ru" ? "Автор" : "Author";
      const authorNotice = proj.originalAuthor
        ? `<div class="card-attribution"><span class="author-badge">${authorLabel}: ${proj.originalAuthor}</span></div>`
        : "";

      const tagsHtml = (tr.tags || [])
        .map((t) => `<span>#${t}</span>`)
        .join("");
      const privateLabel =
        lang === "uz"
          ? "Yopiq repo / Ishlanmoqda"
          : lang === "ru"
            ? "Приватный / В разработке"
            : "Private / In progress";
      const linkHtml = proj.link
        ? `<a href="${proj.link}" target="_blank" rel="noopener noreferrer" class="card-link" onclick="event.stopPropagation();">${proj.linkText || "GitHub Repo →"}</a>`
        : `<span class="card-link card-link-private">${privateLabel}</span>`;

      return `
                <div class="catalog-card" ${targetAttr} data-categories="${cats}" tabindex="0" role="button" aria-label="${tr.title}">
                    <div class="card-header">
                        <span class="card-icon"><span class="planet-orb orb-${(proj.id || "default").toLowerCase()}"></span></span>
                        <div>
                            <h3>${tr.title}</h3>
                            <span class="card-type">${tr.badge || "Loyiha"}</span>
                        </div>
                    </div>
                    ${authorNotice}
                    <p>${tr.subtitle || tr.content.slice(0, 140)}...</p>
                    <div class="card-tags">
                        ${tagsHtml}
                    </div>
                    ${linkHtml}
                </div>
            `;
    }

    if (myProjects.length > 0) {
      html += `<div class="catalog-section-header personal-section">
                <h4>${currentSectionTitles.mine} (${myProjects.length})</h4>
            </div>`;
      html += myProjects.map(renderCard).join("");
    }

    if (toolsAndOpenSource.length > 0) {
      html += `<div class="catalog-section-header tools-section">
                <h4>${currentSectionTitles.tools} (${toolsAndOpenSource.length})</h4>
            </div>`;
      html += toolsAndOpenSource.map(renderCard).join("");
    }

    catalogGrid.innerHTML = html;

    // Attach click handlers to cards
    const cards = catalogGrid.querySelectorAll(".catalog-card");
    cards.forEach((card) => {
      function handleSelect() {
        playUiClick();
        const target = card.getAttribute("data-target");
        if (target && typeof onSelectTarget === "function") {
          closeCatalog();
          onSelectTarget(target);
        }
      }

      card.addEventListener("click", handleSelect);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      });
    });
  }

  function openCatalog() {
    if (!catalogModal) return;
    playUiOpen();
    catalogModal.classList.remove("hidden");
    catalogModal.setAttribute("role", "dialog");
    catalogModal.setAttribute("aria-modal", "true");
    catalogModal.setAttribute("aria-labelledby", "catalog-heading");

    renderCatalog();
    trapFocus(catalogModal);
  }

  function closeCatalog() {
    if (!catalogModal || catalogModal.classList.contains("hidden")) return;
    playUiClose();
    catalogModal.classList.add("hidden");

    if (activeTrapCleanup) {
      activeTrapCleanup();
      activeTrapCleanup = null;
    }
  }

  if (catalogClose) {
    catalogClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closeCatalog();
    });
  }

  // Category button filters
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      categoryButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-category") || "all";
      renderCatalog();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      searchQuery = val;
      if (searchClear) {
        if (val) searchClear.classList.remove("hidden");
        else searchClear.classList.add("hidden");
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderCatalog();
      }, 200);
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      if (searchInput) {
        searchInput.value = "";
        searchQuery = "";
        searchInput.focus();
      }
      searchClear.classList.add("hidden");
      renderCatalog();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (catalogModal && !catalogModal.classList.contains("hidden")) {
        closeCatalog();
      }
    }
  });

  return {
    openCatalog,
    closeCatalog,
    setLanguage: (lang) => {
      currentLanguage = lang;
      renderCatalog();
    },
    isOpen: () => catalogModal && !catalogModal.classList.contains("hidden"),
  };
}
