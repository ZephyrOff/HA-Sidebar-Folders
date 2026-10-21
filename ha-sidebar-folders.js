
/* Home Assistant Sidebar Folders
 * Version: 0.2.0
 * Configuration locale au navigateur.
 */
(() => {
  "use strict";

  const VERSION = "0.2.0";
  const STORAGE_KEY = "ha-sidebar-folders:v2";
  const MODAL_ID = "hsf-modal";
  const STYLE_ID = "hsf-styles";

  let config = loadConfig();
  let observer;
  let timer;
  let longPressTarget;
  let longPressTriggered = false;
  let renderQueued = false;

  const defaultConfig = () => ({
    folders: [],
    assignments: {},
    hidden: [],
    order: [],
    collapsed: []
  });

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.folders)) {
        return { ...defaultConfig(), ...saved };
      }
    } catch (error) {
      console.warn("[Sidebar Folders] Configuration invalide", error);
    }
    return defaultConfig();
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function deepQuery(root, selector) {
    const results = [];
    const visited = new Set();

    function visit(node) {
      if (!node || visited.has(node)) return;
      visited.add(node);

      try {
        if (node.matches?.(selector)) results.push(node);
        results.push(...(node.querySelectorAll?.(selector) || []));
      } catch (_) {}

      for (const el of node.querySelectorAll?.("*") || []) {
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    }

    visit(root);
    return [...new Set(results)];
  }

  function findSidebar() {
    return deepQuery(document, "ha-sidebar")[0] || null;
  }

  function getLabel(el) {
    const values = [
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
      el.querySelector?.("[slot='headline']")?.textContent,
      el.querySelector?.(".item-text")?.textContent,
      el.textContent
    ];

    for (const value of values) {
      const label = (value || "").replace(/\s+/g, " ").trim();
      if (label && label.length < 100) return label;
    }
    return "";
  }

  function getItems() {
    const sidebar = findSidebar();
    if (!sidebar) return [];

    const selectors =
      "ha-list-item, ha-list-item-button, ha-sidebar-item, a[role='listitem']";

    const candidates = deepQuery(sidebar.shadowRoot || sidebar, selectors);

    const items = candidates.filter(el => {
      if (!getLabel(el)) return false;
      if (el.closest?.(`#${MODAL_ID}`)) return false;
      if (el.dataset.hsfGenerated) return false;

      // Keep the outermost matching sidebar entry, not its nested children.
      return !candidates.some(other =>
        other !== el && other.contains?.(el)
      );
    });

    return items.map(el => {
      const label = getLabel(el);
      const href =
        el.getAttribute("href") ||
        el.querySelector?.("a[href]")?.getAttribute("href") ||
        el.getAttribute("data-panel") ||
        el.getAttribute("panel") ||
        el.id ||
        "";

      // Keep identity stable when possible; label is a fallback.
      const key = `${href}::${label}`.toLowerCase();
      return { el, label, key };
    });
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID} {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; background: rgba(0,0,0,.55);
        color: var(--primary-text-color, #222);
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
      }
      #${MODAL_ID} * { box-sizing: border-box; }
      #${MODAL_ID} .hsf-dialog {
        display: flex; flex-direction: column; gap: 16px;
        width: min(760px, 100%); max-height: 90vh;
        overflow: hidden; padding: 22px;
        background: var(--card-background-color, #fff);
        border-radius: 16px; box-shadow: 0 12px 40px #0005;
      }
      #${MODAL_ID} .hsf-top, #${MODAL_ID} .hsf-actions,
      #${MODAL_ID} .hsf-row, #${MODAL_ID} .hsf-folder-title {
        display: flex; align-items: center; gap: 10px;
      }
      #${MODAL_ID} .hsf-top h2 { flex: 1; margin: 0; font-size: 1.3rem; }
      #${MODAL_ID} .hsf-content { overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
      #${MODAL_ID} .hsf-folder, #${MODAL_ID} .hsf-unassigned {
        border: 1px solid var(--divider-color, #ddd);
        border-radius: 12px; padding: 12px; min-height: 55px;
      }
      #${MODAL_ID} .hsf-folder.hsf-drop, #${MODAL_ID} .hsf-unassigned.hsf-drop {
        outline: 2px dashed var(--primary-color, #03a9f4);
      }
      #${MODAL_ID} .hsf-row { padding: 8px; border-radius: 8px; }
      #${MODAL_ID} .hsf-entry { cursor: grab; }
      #${MODAL_ID} .hsf-entry:hover { background: var(--secondary-background-color, #eee); }
      #${MODAL_ID} .hsf-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
      #${MODAL_ID} button {
        font: inherit; cursor: pointer; border: 1px solid var(--divider-color, #ccc);
        border-radius: 8px; padding: 8px 11px;
        background: var(--card-background-color, #fff);
        color: inherit;
      }
      #${MODAL_ID} button:hover { border-color: var(--primary-color, #03a9f4); }
      #${MODAL_ID} button.hsf-primary {
        background: var(--primary-color, #03a9f4); color: white; border: 0;
      }
      #${MODAL_ID} .hsf-muted { opacity: .55; }
      #${MODAL_ID} .hsf-folder-items { padding-left: 12px; }
      #${MODAL_ID} .hsf-actions { justify-content: flex-end; }
      #${MODAL_ID} input {
        min-width: 0; padding: 9px 10px; border-radius: 8px;
        border: 1px solid var(--divider-color, #ccc);
        background: var(--primary-background-color, white); color: inherit;
      }
      #${MODAL_ID} .hsf-search { width: 100%; }
      #${MODAL_ID} .hsf-empty { opacity: .65; padding: 8px; font-size: .9em; }
    `;
    document.head.appendChild(style);
  }

  function icon(name) {
    const icons = {
      folder: "📁",
      eye: "👁",
      hidden: "◉̸",
      grip: "⠿",
      close: "✕",
      edit: "✎",
      delete: "🗑",
      down: "▾",
      right: "▸"
    };
    return icons[name] || "";
  }

  function createFolder() {
    const name = prompt("Nom du dossier :");
    if (!name?.trim()) return;

    config.folders.push({
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim()
    });
    renderModal();
  }

  function renameFolder(folder) {
    const name = prompt("Nouveau nom :", folder.name);
    if (name?.trim()) {
      folder.name = name.trim();
      renderModal();
    }
  }

  function deleteFolder(folder) {
    if (!confirm(`Supprimer le dossier « ${folder.name} » ? Les éléments resteront dans la sidebar.`)) {
      return;
    }
    config.folders = config.folders.filter(f => f.id !== folder.id);
    for (const key of Object.keys(config.assignments)) {
      if (config.assignments[key] === folder.id) {
        delete config.assignments[key];
      }
    }
    config.collapsed = config.collapsed.filter(id => id !== folder.id);
    renderModal();
  }

  function moveToFolder(key, folderId) {
    if (folderId) config.assignments[key] = folderId;
    else delete config.assignments[key];

    if (folderId) {
      config.hidden = config.hidden.filter(k => k !== key);
    }
    renderModal();
  }

  function toggleHidden(key) {
    config.hidden = config.hidden.includes(key)
      ? config.hidden.filter(k => k !== key)
      : [...config.hidden, key];
    renderModal();
  }

  function makeEntry(item, search) {
    if (search && !item.label.toLowerCase().includes(search)) return null;

    const hidden = config.hidden.includes(item.key);
    const row = document.createElement("div");
    row.className = `hsf-row hsf-entry${hidden ? " hsf-muted" : ""}`;
    row.draggable = true;
    row.dataset.key = item.key;
    row.innerHTML = `
      <span aria-hidden="true">${icon("grip")}</span>
      <span class="hsf-label"></span>
      <button type="button" data-action="visibility"
        title="${hidden ? "Réafficher dans la sidebar" : "Masquer dans la sidebar"}"
        aria-label="${hidden ? "Réafficher" : "Masquer"}">${hidden ? icon("hidden") : icon("eye")}</button>
    `;
    row.querySelector(".hsf-label").textContent = item.label;

    row.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/hsf-key", item.key);
      event.dataTransfer.effectAllowed = "move";
    });
    row.querySelector('[data-action="visibility"]').addEventListener("click", () => {
      toggleHidden(item.key);
    });
    return row;
  }

  function setupDropZone(zone, folderId) {
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("hsf-drop");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("hsf-drop"));
    zone.addEventListener("drop", event => {
      event.preventDefault();
      zone.classList.remove("hsf-drop");
      const key = event.dataTransfer.getData("text/hsf-key");
      if (key) moveToFolder(key, folderId);
    });
  }

  function renderModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    const items = getItems();
    const content = modal.querySelector(".hsf-content");
    const search = (modal.querySelector(".hsf-search").value || "").trim().toLowerCase();
    content.replaceChildren();

    const itemByKey = new Map(items.map(item => [item.key, item]));

    for (const folder of config.folders) {
      const box = document.createElement("section");
      box.className = "hsf-folder";
      setupDropZone(box, folder.id);

      const title = document.createElement("div");
      title.className = "hsf-folder-title";
      title.innerHTML = `
        <span aria-hidden="true">${icon("folder")}</span>
        <strong class="hsf-label"></strong>
        <button type="button" data-action="rename" title="Renommer">${icon("edit")}</button>
        <button type="button" data-action="delete" title="Supprimer">${icon("delete")}</button>
      `;
      title.querySelector("strong").textContent = folder.name;
      title.querySelector('[data-action="rename"]').addEventListener("click", () => renameFolder(folder));
      title.querySelector('[data-action="delete"]').addEventListener("click", () => deleteFolder(folder));
      box.appendChild(title);

      const children = document.createElement("div");
      children.className = "hsf-folder-items";

      const members = items.filter(item => config.assignments[item.key] === folder.id);
      for (const item of members) {
        const entry = makeEntry(item, search);
        if (entry) children.appendChild(entry);
      }
      if (!members.length) {
        const empty = document.createElement("div");
        empty.className = "hsf-empty";
        empty.textContent = "Glisse des éléments ici";
        children.appendChild(empty);
      }
      box.appendChild(children);
      content.appendChild(box);
    }

    const unassigned = document.createElement("section");
    unassigned.className = "hsf-unassigned";
    setupDropZone(unassigned, null);

    const heading = document.createElement("strong");
    heading.textContent = "Éléments sans dossier";
    unassigned.appendChild(heading);

    const looseItems = items.filter(item => !config.assignments[item.key]);
    for (const item of looseItems) {
      const entry = makeEntry(item, search);
      if (entry) unassigned.appendChild(entry);
    }
    if (!looseItems.length) {
      const empty = document.createElement("div");
      empty.className = "hsf-empty";
      empty.textContent = "Tous les éléments sont dans des dossiers.";
      unassigned.appendChild(empty);
    }
    content.appendChild(unassigned);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "hsf-empty";
      empty.textContent = "Aucun élément détecté. Vérifie la structure de la sidebar de cette version de Home Assistant.";
      content.appendChild(empty);
    }
  }

  function openModal() {
    if (document.getElementById(MODAL_ID)) return;

    installStyles();
    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="hsf-dialog" role="dialog" aria-modal="true"
        aria-labelledby="hsf-title">
        <div class="hsf-top">
          <h2 id="hsf-title">Organisation de la sidebar</h2>
          <button type="button" data-action="close" aria-label="Fermer">${icon("close")}</button>
        </div>
        <input class="hsf-search" type="search" placeholder="Rechercher un élément…" />
        <div class="hsf-actions" style="justify-content:flex-start">
          <button type="button" data-action="new-folder">＋ Nouveau dossier</button>
        </div>
        <div class="hsf-content"></div>
        <div class="hsf-actions">
          <button type="button" data-action="cancel">Annuler</button>
          <button type="button" class="hsf-primary" data-action="save">Enregistrer</button>
        </div>
      </div>
    `;

    const original = JSON.stringify(config);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();
      const action = event.target.closest("button")?.dataset.action;
      if (action === "close" || action === "cancel") {
        config = JSON.parse(original);
        closeModal();
      } else if (action === "new-folder") {
        createFolder();
      } else if (action === "save") {
        saveConfig();
        closeModal();
        scheduleApply();
      }
    });
    modal.querySelector(".hsf-search").addEventListener("input", renderModal);
    document.body.appendChild(modal);
    renderModal();

    modal.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        config = JSON.parse(original);
        closeModal();
      }
    });
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
  }

  function scheduleApply() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      applyConfig();
    });
  }

  function applyConfig() {
    const items = getItems();
    if (!items.length) return;

    // Clear the effects from the previous application.
    const sidebar = findSidebar();
    const root = sidebar?.shadowRoot || sidebar;
    if (!root) return;

    deepQuery(root, "[data-hsf-generated='header']").forEach(el => el.remove());
    items.forEach(({ el }) => {
      el.style.display = "";
      el.removeAttribute("data-hsf-managed");
    });

    // Keep hidden entries out of the regular sidebar.
    for (const item of items) {
      if (config.hidden.includes(item.key)) {
        item.el.style.display = "none";
        item.el.dataset.hsfManaged = "hidden";
      }
    }

    // Grouping is applied only when the sidebar entries share a parent.
    const visible = items.filter(item => !config.hidden.includes(item.key));
    const parents = new Set(visible.map(item => item.el.parentElement));
    if (parents.size !== 1 || !visible.length) return;

    const parent = visible[0].el.parentElement;
    const originalOrder = visible.map(item => item.key);
    const order = [
      ...config.order.filter(key => originalOrder.includes(key)),
      ...originalOrder.filter(key => !config.order.includes(key))
    ];
    const byKey = new Map(visible.map(item => [item.key, item]));

    const sequence = [];
    for (const folder of config.folders) {
      const members = order.filter(key => config.assignments[key] === folder.id);
      if (!members.length) continue;

      const header = document.createElement("button");
      header.type = "button";
      header.dataset.hsfGenerated = "header";
      header.className = "hsf-sidebar-folder";
      header.style.cssText = [
        "display:flex", "align-items:center", "gap:10px", "width:100%",
        "padding:10px 16px", "border:0", "background:transparent",
        "color:var(--primary-text-color)", "font:inherit", "text-align:left",
        "cursor:pointer", "font-weight:600"
      ].join(";");

      const isCollapsed = config.collapsed.includes(folder.id);
      header.innerHTML = `<span>${isCollapsed ? "▸" : "▾"}</span><span></span>`;
      header.lastElementChild.textContent = folder.name;
      header.addEventListener("click", () => {
        config.collapsed = isCollapsed
          ? config.collapsed.filter(id => id !== folder.id)
          : [...config.collapsed, folder.id];
        saveConfig();
        scheduleApply();
      });
      sequence.push(header, ...members.map(key => byKey.get(key).el));
    }

    sequence.push(...order
      .filter(key => !config.assignments[key] ||
        !config.folders.some(folder => folder.id === config.assignments[key]))
      .map(key => byKey.get(key).el));

    for (const folder of config.folders) {
      if (!config.collapsed.includes(folder.id)) continue;
      for (const item of items) {
        if (config.assignments[item.key] === folder.id) {
          item.el.style.display = "none";
        }
      }
    }

    // Insert all managed nodes at the first item position, preserving the rest of the sidebar.
    const first = visible[0].el;
    const marker = document.createComment("hsf insertion point");
    parent.insertBefore(marker, first);

    let cursor = marker;
    for (const node of sequence) {
      parent.insertBefore(node, cursor.nextSibling);
      cursor = node;
    }
    marker.remove();
  }

  function attachLongPress() {
    const sidebar = findSidebar();
    if (!sidebar?.shadowRoot) return;

    const settings = deepQuery(sidebar.shadowRoot,
      "#sidebar-config, [data-panel='config'], ha-list-item[aria-label='Settings']")[0];
    if (!settings || settings.dataset.hsfBound === "1") return;

    settings.dataset.hsfBound = "1";
    settings.addEventListener("pointerdown", () => {
      longPressTarget = settings;
      longPressTriggered = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        longPressTriggered = true;
        openModal();
      }, 700);
    }, true);

    const cancel = () => clearTimeout(timer);
    settings.addEventListener("pointerup", cancel, true);
    settings.addEventListener("pointerleave", cancel, true);
    settings.addEventListener("pointercancel", cancel, true);
    settings.addEventListener("click", event => {
      if (longPressTriggered && longPressTarget === settings) {
        event.preventDefault();
        event.stopImmediatePropagation();
        longPressTriggered = false;
      }
    }, true);
  }

  function start() {
    if (observer) observer.disconnect();
    attachLongPress();
    scheduleApply();

    observer = new MutationObserver(() => {
      attachLongPress();
      scheduleApply();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  console.info(`[Sidebar Folders] chargé v${VERSION}`);
})();
