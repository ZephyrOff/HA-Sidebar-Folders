/* Home Assistant Sidebar Folders — experimental frontend extension
 * Organizes existing sidebar entries into collapsible folders.
 * Configuration is stored in localStorage (per browser).
 */
(() => {
  "use strict";

  const VERSION = "0.1.0";
  const STORAGE_KEY = "ha-sidebar-folders:v1";
  const STYLE_ID = "ha-sidebar-folders-style";
  const ROOT_ID = "ha-sidebar-folders-controls";
  const ITEM_SELECTOR = "ha-list-item-button, ha-sidebar-item, a[role='listitem']";

  const defaultConfig = () => ({
    folders: [
      { id: "folder-maison", name: "Maison", icon: "mdi:home", collapsed: false, items: [] },
      { id: "folder-energie", name: "Énergie", icon: "mdi:lightning-bolt", collapsed: true, items: [] },
      { id: "folder-systeme", name: "Système", icon: "mdi:cog", collapsed: true, items: [] }
    ],
    hidden: [],
    order: [],
    editMode: false
  });

  let config = loadConfig();
  let observer = null;
  let renderPending = false;
  let currentSidebar = null;

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.folders)) return { ...defaultConfig(), ...saved };
    } catch (e) {
      console.warn("[Sidebar Folders] Configuration illisible, réinitialisation.", e);
    }
    return defaultConfig();
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("[Sidebar Folders] Impossible de sauvegarder la configuration.", e);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function deepQuery(root, selector) {
    const found = [];
    const visit = node => {
      if (!node) return;
      try {
        if (node.matches && node.matches(selector)) found.push(node);
        if (node.querySelectorAll) found.push(...node.querySelectorAll(selector));
      } catch (_) {}
      const all = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (const el of all) if (el.shadowRoot) visit(el.shadowRoot);
    };
    visit(root);
    return [...new Set(found)];
  }

  function findSidebar() {
    return document.querySelector("ha-sidebar") ||
      deepQuery(document, "ha-sidebar")[0] ||
      null;
  }

  function getSidebarItems(sidebar) {
    if (!sidebar) return [];
    const candidates = deepQuery(sidebar.shadowRoot || sidebar, ITEM_SELECTOR);
    return [...new Set(candidates)].filter(el => {
      if (el.id === ROOT_ID || el.closest?.(`#${ROOT_ID}`)) return false;
      const label = getLabel(el);
      return Boolean(label) && !el.dataset?.hsfFolderHeader;
    }).filter(el => {
      // Avoid accidentally treating descendants of another sidebar item as separate entries.
      return !candidates.some(other => other !== el && other.contains?.(el) && other.matches?.(ITEM_SELECTOR));
    });
  }

  function getLabel(el) {
    const candidates = [
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
      el.querySelector?.(".item-text")?.textContent,
      el.querySelector?.("[slot='headline']")?.textContent,
      el.querySelector?.("[slot='label']")?.textContent,
      el.shadowRoot?.querySelector?.(".item-text")?.textContent,
      el.shadowRoot?.querySelector?.("[slot='label']")?.textContent,
      el.textContent
    ];
    for (const value of candidates) {
      const text = (value || "").replace(/\s+/g, " ").trim();
      if (text && text.length < 100) return text;
    }
    return "";
  }

  function itemKey(el) {
    const href = el.getAttribute?.("href") ||
      el.querySelector?.("a")?.getAttribute("href") ||
      el.getAttribute?.("data-panel") ||
      el.getAttribute?.("panel");
    const label = getLabel(el);
    return `${href || ""}::${label}`.toLowerCase();
  }

  function injectStyles(root) {
    if (root.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hsf-folder-header {
        box-sizing: border-box; display:flex; align-items:center; gap:10px;
        width:100%; min-height:42px; padding:8px 12px; margin:4px 0 2px;
        border:0; border-radius:8px; background:transparent; color:var(--primary-text-color);
        font:inherit; text-align:left; cursor:pointer; user-select:none;
      }
      .hsf-folder-header:hover { background:var(--secondary-background-color); }
      .hsf-folder-header .hsf-folder-name { flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; }
      .hsf-folder-header .hsf-chevron { opacity:.7; }
      .hsf-folder-header .hsf-count { font-size:.8em; opacity:.65; }
      .hsf-folder-header[aria-expanded="false"] { opacity:.9; }
      .hsf-folder-header.hsf-drop-target { outline:2px dashed var(--primary-color); outline-offset:-2px; }
      #${ROOT_ID} { padding:6px 10px; }
      #${ROOT_ID} button { font:inherit; cursor:pointer; border:1px solid var(--divider-color);
        color:var(--primary-text-color); background:var(--card-background-color);
        border-radius:8px; padding:7px 10px; margin:2px 4px 2px 0; }
      #${ROOT_ID} button:hover { border-color:var(--primary-color); }
      .hsf-editing [data-hsf-key] { outline:1px dashed var(--divider-color); outline-offset:-2px; }
      .hsf-hidden-badge { font-size:.75em; opacity:.7; margin-left:6px; }
    `;
    root.appendChild(style);
  }

  function makeFolderHeader(folder, items) {
    const header = document.createElement("button");
    header.type = "button";
    header.className = "hsf-folder-header";
    header.dataset.hsfFolderHeader = folder.id;
    header.dataset.hsfFolder = folder.id;
    header.draggable = config.editMode;
    header.setAttribute("aria-expanded", String(!folder.collapsed));
    header.innerHTML = `
      <span aria-hidden="true">${folder.icon ? "📁" : "▸"}</span>
      <span class="hsf-folder-name">${escapeHtml(folder.name)}</span>
      <span class="hsf-count">${items.length}</span>
      <span class="hsf-chevron" aria-hidden="true">${folder.collapsed ? "▸" : "▾"}</span>
    `;
    header.addEventListener("click", event => {
      if (config.editMode && event.altKey) return;
      folder.collapsed = !folder.collapsed;
      saveConfig();
      scheduleRender();
    });
    header.addEventListener("dragover", event => {
      if (!config.editMode) return;
      event.preventDefault();
      header.classList.add("hsf-drop-target");
    });
    header.addEventListener("dragleave", () => header.classList.remove("hsf-drop-target"));
    header.addEventListener("drop", event => {
      if (!config.editMode) return;
      event.preventDefault();
      header.classList.remove("hsf-drop-target");
      const key = event.dataTransfer?.getData("text/hsf-key");
      if (!key) return;
      assignToFolder(key, folder.id);
    });
    return header;
  }

  function assignToFolder(key, folderId) {
    config.folders.forEach(folder => folder.items = folder.items.filter(k => k !== key));
    const target = config.folders.find(folder => folder.id === folderId);
    if (target && !target.items.includes(key)) target.items.push(key);
    config.hidden = config.hidden.filter(k => k !== key);
    saveConfig();
    scheduleRender();
  }

  function createToolbar(sidebar) {
    let toolbar = deepQuery(sidebar.shadowRoot || sidebar, `#${ROOT_ID}`)[0];
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = ROOT_ID;
      toolbar.innerHTML = `
        <button type="button" data-action="edit">Organiser</button>
        <button type="button" data-action="folder">+ Dossier</button>
        <button type="button" data-action="reset" title="Réinitialiser l'organisation locale">Réinitialiser</button>
      `;
      toolbar.addEventListener("click", event => {
        const action = event.target.closest("button")?.dataset.action;
        if (action === "edit") {
          config.editMode = !config.editMode;
          saveConfig();
          scheduleRender();
        } else if (action === "folder") {
          const name = window.prompt("Nom du nouveau dossier :");
          if (!name?.trim()) return;
          config.folders.push({
            id: `folder-${Date.now()}`, name: name.trim(), icon: "mdi:folder",
            collapsed: false, items: []
          });
          config.editMode = true;
          saveConfig();
          scheduleRender();
        } else if (action === "reset") {
          if (window.confirm("Réinitialiser les dossiers, l'ordre et les éléments masqués sur ce navigateur ?")) {
            localStorage.removeItem(STORAGE_KEY);
            config = defaultConfig();
            scheduleRender();
          }
        }
      });
      const root = sidebar.shadowRoot || sidebar;
      root.prepend(toolbar);
    }
    const edit = toolbar.querySelector('[data-action="edit"]');
    if (edit) edit.textContent = config.editMode ? "Terminer" : "Organiser";
    const add = toolbar.querySelector('[data-action="folder"]');
    if (add) add.style.display = config.editMode ? "" : "none";
    const reset = toolbar.querySelector('[data-action="reset"]');
    if (reset) reset.style.display = config.editMode ? "" : "none";
    toolbar.style.display = config.editMode ? "" : "none";
  }

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      // Ignore DOM mutations produced by our own render to avoid a MutationObserver loop.
      if (observer) observer.disconnect();
      render();
      if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  function render() {
    const sidebar = findSidebar();
    if (!sidebar) return;
    currentSidebar = sidebar;
    const root = sidebar.shadowRoot || sidebar;
    injectStyles(root);

    // Remove our previous headers; native entries are retained.
    deepQuery(root, ".hsf-folder-header").forEach(el => el.remove());

    let items = getSidebarItems(sidebar);
    if (!items.length) return;

    // Recompute keys after Home Assistant changes its sidebar.
    items.forEach(el => {
      const key = itemKey(el);
      el.dataset.hsfKey = key;
      el.draggable = config.editMode;
      if (config.editMode) {
        el.classList.add("hsf-editing");
        el.addEventListener("dragstart", onDragStart, { once: true });
      } else {
        el.classList.remove("hsf-editing");
      }
    });

    const itemByKey = new Map(items.map(el => [el.dataset.hsfKey, el]));
    const parent = items[0].parentElement;
    if (!parent) return;

    // Restore items to visible state before applying current organization.
    items.forEach(el => { el.style.display = ""; });

    // Move items into the configured order while keeping unrecognized entries.
    const orderedKeys = config.order.filter(k => itemByKey.has(k));
    const rest = items.map(el => el.dataset.hsfKey).filter(k => !orderedKeys.includes(k));
    const finalKeys = [...orderedKeys, ...rest];

    // Native sidebar items may have different parents in future versions; only reorder siblings.
    const siblings = items.every(el => el.parentElement === parent);
    if (siblings) {
      finalKeys.forEach(key => parent.appendChild(itemByKey.get(key)));
      items = finalKeys.map(key => itemByKey.get(key));
    }

    // Hide selected items, but keep them available in edit mode.
    items.forEach(el => {
      const key = el.dataset.hsfKey;
      el.style.display = config.hidden.includes(key) && !config.editMode ? "none" : "";
      if (config.editMode && config.hidden.includes(key)) {
        el.style.opacity = "0.45";
        if (!el.querySelector?.(".hsf-hidden-badge")) {
          const badge = document.createElement("span");
          badge.className = "hsf-hidden-badge";
          badge.textContent = "masqué";
          el.appendChild(badge);
        }
      } else {
        el.style.opacity = "";
        el.querySelector?.(".hsf-hidden-badge")?.remove();
      }
    });

    // Render each folder header before its first item; folders are collapsed by hiding their members.
    for (const folder of config.folders) {
      const members = folder.items.map(k => itemByKey.get(k)).filter(Boolean);
      if (!members.length) continue;
      const header = makeFolderHeader(folder, members);
      const first = members[0];
      first.parentElement?.insertBefore(header, first);
      members.forEach(el => {
        el.dataset.hsfFolder = folder.id;
        if (folder.collapsed && !config.editMode) el.style.display = "none";
      });
    }

    // Edit-mode drag and drop: drop outside a folder to ungroup.
    if (config.editMode) {
      items.forEach(el => {
        el.addEventListener("dragover", onDragOver);
        el.addEventListener("drop", onDrop);
        el.addEventListener("contextmenu", onContextMenu);
        el.title = `${getLabel(el)} — clic droit : options d'organisation`;
      });
    } else {
      items.forEach(el => {
        el.removeEventListener("dragover", onDragOver);
        el.removeEventListener("drop", onDrop);
        el.removeEventListener("contextmenu", onContextMenu);
        el.removeAttribute("title");
      });
    }

    createToolbar(sidebar);
  }

  function onDragStart(event) {
    const key = event.currentTarget.dataset.hsfKey;
    if (!key) return;
    event.dataTransfer?.setData("text/hsf-key", key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(event) {
    if (config.editMode) event.preventDefault();
  }

  function onDrop(event) {
    if (!config.editMode) return;
    event.preventDefault();
    const key = event.dataTransfer?.getData("text/hsf-key");
    if (!key) return;
    const target = event.currentTarget;
    const targetKey = target.dataset.hsfKey;
    if (key === targetKey) return;
    const folderId = target.dataset.hsfFolder;
    if (folderId) {
      assignToFolder(key, folderId);
    } else {
      config.folders.forEach(folder => folder.items = folder.items.filter(k => k !== key));
      const from = config.order.indexOf(key);
      if (from >= 0) config.order.splice(from, 1);
      const to = config.order.indexOf(targetKey);
      if (to >= 0) config.order.splice(to, 0, key);
      else config.order.push(key);
      saveConfig();
      scheduleRender();
    }
  }

  function onContextMenu(event) {
    if (!config.editMode) return;
    event.preventDefault();
    const el = event.currentTarget;
    const key = el.dataset.hsfKey;
    const label = getLabel(el);
    const choices = ["Déplacer hors d'un dossier", "Masquer / réafficher", "Annuler"];
    const choice = window.prompt(
      `Organisation de « ${label} »\n1 = déplacer hors d'un dossier\n2 = masquer/réafficher\n3 = annuler`,
      "1"
    );
    if (choice === "1") {
      config.folders.forEach(folder => folder.items = folder.items.filter(k => k !== key));
    } else if (choice === "2") {
      config.hidden = config.hidden.includes(key)
        ? config.hidden.filter(k => k !== key)
        : [...config.hidden, key];
    } else {
      return;
    }
    saveConfig();
    scheduleRender();
  }

  let holdTimer = null;
  let holdTriggered = false;
  let holdTarget = null;

  function attachSettingsHold(sidebar) {
    const root = sidebar?.shadowRoot;
    if (!root) return;
    const settings = root.querySelector("#sidebar-config");
    if (!settings || settings.dataset.hsfHoldBound === "1") return;
    settings.dataset.hsfHoldBound = "1";

    settings.addEventListener("pointerdown", () => {
      holdTriggered = false;
      holdTarget = settings;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        holdTriggered = true;
        config.editMode = true;
        saveConfig();
        scheduleRender();
        console.info("[Sidebar Folders] mode organisation activé par appui long sur Paramètres");
      }, 650);
    }, true);

    const cancelHold = () => clearTimeout(holdTimer);
    settings.addEventListener("pointerup", cancelHold, true);
    settings.addEventListener("pointerleave", cancelHold, true);
    settings.addEventListener("pointercancel", cancelHold, true);
    settings.addEventListener("click", event => {
      if (holdTriggered && holdTarget === settings) {
        event.preventDefault();
        event.stopImmediatePropagation();
        holdTriggered = false;
        holdTarget = null;
      }
    }, true);
  }

  function start() {
    if (!document.body) return;
    const attempt = () => {
      const sidebar = findSidebar();
      if (sidebar && sidebar !== currentSidebar) currentSidebar = sidebar;
      if (sidebar) {
        attachSettingsHold(sidebar);
        render();
      }
    };
    attempt();
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => scheduleRender());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // Re-attach when HA replaces its sidebar after navigation.
    window.addEventListener("location-changed", scheduleRender);
    window.addEventListener("popstate", scheduleRender);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  console.info(`[Sidebar Folders] chargé v${VERSION} — prototype expérimental`);
})();
