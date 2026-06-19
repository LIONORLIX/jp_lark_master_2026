import fs from "node:fs";
import path from "node:path";
import { loadDotEnv } from "./env.js";

loadDotEnv();

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");

function mustReadJson(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}. Run: npm run fetch`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderIndex({ title = "Reimagine 2026 Photo" } = {}) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <link rel="icon" type="image/png" href="./assets/favicon.png" />
    <link rel="apple-touch-icon" href="./assets/favicon.png" />
    <meta property="og:title" content="${htmlEscape(title)}" />
    <style>
      :root {
        color-scheme: light;
        --nav-h: 34px;
        --nav-gap: 8px;
        --banner-h: clamp(180px, 28vw, 380px);
        /* Painted height of sticky nav (padding + row + border); use for tab bar offset on mobile */
        --nav-bar-outer: calc(6px + var(--nav-h) + 6px + 1px);
      }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; background:#0b0d12; color:#e7e9ee; }
      a { color: inherit; }
      /* Nav outside .wrap: mobile WebKit often breaks sticky when the bar sits inside max-width + negative margin hacks */
      .site { padding-top: 20px; }
      .wrap { max-width: 1200px; margin: 0 auto; padding: 0 14px 56px; }
      .nav {
        position: -webkit-sticky;
        position: sticky;
        top: 0;
        z-index: 50;
        box-sizing: border-box;
        width: 100%;
        margin: 0 0 10px;
        padding: 6px 0;
        height: calc(var(--nav-h) + 12px);
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(11,13,18,.72);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      .nav-inner {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 14px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
      .nav a { display:flex; align-items:center; gap:10px; }
      .nav img { height: 20px; width:auto; display:block; }
      .banner {
        width: 100vw;
        height: var(--banner-h);
        margin-left: calc(50% - 50vw);
        margin-right: calc(50% - 50vw);
        margin-bottom: 24px;
        line-height: 0;
        font-size: 0;
        overflow: hidden;
        border-radius: 0;
        background: #0b0d12;
      }
      .banner img { 
        width: 100%; 
        height: 100%;
        display: block; 
        vertical-align: middle;
        object-fit: contain;
        /* Avoid 1px hairlines from subpixel scaling */
        transform: translateZ(0) scale(1.01);
        transform-origin: center;
      }
      .top { display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
      h1 { margin:0; font-size:18px; font-weight:700; letter-spacing: .2px; }
      .layout { display:flex; gap: 14px; margin-top: 14px; align-items:flex-start; }
      .sidebar { width: 220px; flex: 0 0 auto; position: sticky; top: calc(var(--nav-h) + var(--nav-gap) + 20px); align-self: flex-start; }
      .main { flex: 1 1 auto; min-width: 0; display:flex; flex-direction: column; gap: 10px; }
      .tabs { display:flex; gap:8px; flex-wrap:wrap; }
      .tabs.vertical { flex-direction: column; gap:10px; }
      .tab { border:1px solid rgba(255,255,255,.20); color:#ffffff; background: rgba(255,255,255,.07); padding:8px 10px; border-radius:999px; cursor:pointer; font-size:13px; }
      .tab:hover { background: rgba(255,255,255,.10); }
      .tab[aria-pressed="true"] { background: rgba(99,102,241,.72); border-color: rgba(99,102,241,.95); box-shadow: 0 8px 22px rgba(99,102,241,.22); }
      .meta { opacity:.75; font-size:12px; }
      .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; flex: 1 1 auto; align-content: start; grid-auto-rows: 150px; }
      /* When switching tabs, scrollIntoView should not hide under sticky bars */
      #grid { scroll-margin-top: calc(var(--nav-h) + var(--nav-gap) + 24px); }
      @media (min-width: 720px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; grid-auto-rows: 170px; } }
      @media (min-width: 1024px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      @media (max-width: 720px) {
        :root { --banner-h: clamp(140px, 42vw, 240px); }
        .nav { margin-bottom: 0; }
        .layout { flex-direction: column; }
        .sidebar {
          width: 100%;
          position: sticky;
          /* Overlap 1px to avoid subpixel seam between two sticky layers */
          top: calc(var(--nav-bar-outer) - 1px);
          z-index: 30;
          padding-top: 0;
          padding-bottom: 8px;
          padding-left: 14px;
          padding-right: 14px;
          margin: 0 -14px;
          background: rgba(11,13,18,.78);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255,255,255,.10);
        }
        .tabs.vertical { flex-direction: row; flex-wrap: wrap; }
        #grid { scroll-margin-top: calc(var(--nav-bar-outer) + 12px); }
      }
      .card { border-radius: 14px; overflow: hidden; border:1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.04); position: relative; height: 100%; }
      .card.landscape { grid-row: span 1; }
      .card.portrait { grid-row: span 2; }
      .card img { width:100%; height:100%; display:block; background:#111; object-fit: cover; }
      .card .zoomhint {
        position:absolute;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        background: rgba(0,0,0,.22);
        color: rgba(255,255,255,.92);
        font-size: 34px;
        letter-spacing: 1px;
      }
      @media (hover: hover) and (pointer: fine) {
        .card:hover .zoomhint { display:flex; }
        .card:hover img { cursor: zoom-in; }
      }
      .card .cap { position:absolute; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:flex-end; gap:10px; padding: 10px 10px; background: linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0)); }
      .cap .btn {
        font-size:12px;
        padding:7px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(2,6,23,.88);
        color: #fff;
        text-decoration:none;
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        gap:6px;
        backdrop-filter: blur(6px);
      }
      .cap .btn:hover { background: rgba(2,6,23,.96); border-color: rgba(255,255,255,.24); }
      .cap .btn svg { width: 14px; height: 14px; display:block; opacity: .95; }
      /* Use fixed + translate centering (more reliable on mobile than margin:auto on <dialog>) */
      dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        margin: 0;
        border:1px solid rgba(255,255,255,.18);
        border-radius: 16px;
        padding:0;
        background:#0b0d12;
        color:#e7e9ee;
        width: min(92vw, 980px);
        max-height: 92vh;
        overflow: hidden;
      }
      dialog::backdrop { background: rgba(0,0,0,.72); }
      .dlg-img { width:100%; height:auto; display:block; background:#111; }
      dialog[open] { display: flex; flex-direction: column; }
      .dlg-img { flex: 1 1 auto; width: 100%; height: auto; max-height: calc(92vh - 56px); object-fit: contain; }
      .dlg-bar { flex: 0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border-top:1px solid rgba(255,255,255,.10); }
      .dlg-title { font-size:13px; opacity:.9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dlg-actions { display:flex; gap:8px; flex:0 0 auto; }
      .dlg-actions a, .dlg-actions button {
        font-size:12px;
        padding:8px 10px;
        border-radius: 10px;
        border:1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.06);
        color:inherit;
        cursor:pointer;
        text-decoration:none;
        display:inline-flex;
        align-items:center;
        gap:6px;
      }
      .dlg-actions a svg { width: 14px; height: 14px; display:block; opacity:.95; }
      .dlg-actions a:hover, .dlg-actions button:hover { background: rgba(255,255,255,.10); }
      .navzone {
        position: absolute;
        top: 0;
        bottom: 56px;
        width: 24%;
        cursor: pointer;
        user-select: none;
        display:flex;
        align-items:center;
      }
      .navzone.left { left: 0; }
      .navzone.left { justify-content:flex-start; padding-left: 10px; }
      .navzone.right { right: 0; }
      .navzone.right { justify-content:flex-end; padding-right: 10px; }
      .navbtn {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(2,6,23,.70);
        color: rgba(255,255,255,.92);
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow: 0 10px 26px rgba(0,0,0,.25);
        backdrop-filter: blur(8px);
        opacity: .0;
        transform: translateY(0) scale(.98);
        transition: opacity .15s ease, transform .15s ease, background .15s ease;
      }
      .navbtn svg { width: 18px; height: 18px; display:block; }
      dialog:hover .navbtn { opacity: 1; transform: scale(1); }
      .navzone:active .navbtn { background: rgba(2,6,23,.86); }
      @media (hover: none) {
        .navbtn { opacity: 1; }
      }
    </style>
  </head>
  <body>
    <div class="site">
    <header class="nav" role="banner">
      <div class="nav-inner">
        <a href="https://www.larksuite.com" target="_blank" rel="noopener noreferrer" aria-label="Go to Lark website">
          <img src="./assets/lark-logo.png" alt="Lark" />
        </a>
      </div>
    </header>
    <div class="wrap">
      <div class="banner" role="img" aria-label="Reimagine 2026 banner">
        <img src="./assets/banner.png?v=${Date.now()}" alt="Reimagine 2026" />
      </div>
      <div class="layout">
        <div class="sidebar">
          <div class="tabs vertical" id="tabs"></div>
        </div>
        <div class="main">
          <div class="grid" id="grid"></div>
        </div>
      </div>
    </div>
    </div>

    <dialog id="dlg">
      <div class="navzone left" id="navPrev" aria-label="Previous photo">
        <div class="navbtn" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="navzone right" id="navNext" aria-label="Next photo">
        <div class="navbtn" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <img class="dlg-img" id="dlgImg" alt="" />
      <div class="dlg-bar">
        <div class="dlg-title" id="dlgTitle"></div>
        <div class="dlg-actions">
          <a id="dlgDownload" href="#" download>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 17v3h16v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download original
          </a>
          <button id="dlgClose">Close</button>
        </div>
      </div>
    </dialog>

    <script>
      const $ = (s) => document.querySelector(s);
      const tabsEl = $("#tabs");
      const gridEl = $("#grid");
      const dlg = $("#dlg");
      const dlgImg = $("#dlgImg");
      const dlgTitle = $("#dlgTitle");
      const dlgDownload = $("#dlgDownload");
      const dlgClose = $("#dlgClose");
      const navPrev = $("#navPrev");
      const navNext = $("#navNext");
      const PLACEHOLDER_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

      let all = null;
      let active = "All photos";
      let currentList = [];
      let currentIndex = -1;
      let didInit = false;
      function setActive(cat, { scrollToGrid = true } = {}) {
        active = cat;
        for (const b of tabsEl.querySelectorAll("button")) {
          b.setAttribute("aria-pressed", b.dataset.cat === cat ? "true" : "false");
        }
        renderGrid();
        // Only jump back when user switches tabs (not on first page load).
        if (scrollToGrid && didInit) {
          requestAnimationFrame(() => {
            gridEl.scrollIntoView({ block: "start", behavior: "smooth" });
          });
        }
      }

      function showAt(idx) {
        if (!currentList.length) return;
        const n = currentList.length;
        currentIndex = ((idx % n) + n) % n;
        const p = currentList[currentIndex];
        dlgImg.src = p.original;
        dlgTitle.textContent = "";
        dlgDownload.href = p.original;
        dlgDownload.download = (p.title || p.id || "photo") + ".jpg";
      }

      function openDialog(p) {
        // When opening, use current filtered order.
        currentList = all.photos.filter((x) => active === "All photos" ? true : x.category === active);
        currentIndex = Math.max(0, currentList.findIndex((x) => x.id === p.id));
        showAt(currentIndex);
        dlg.showModal();
      }

      dlgClose.addEventListener("click", () => dlg.close());
      dlg.addEventListener("click", (e) => {
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dlg.close();
      });
      navPrev.addEventListener("click", () => showAt(currentIndex - 1));
      navNext.addEventListener("click", () => showAt(currentIndex + 1));
      window.addEventListener("keydown", (e) => {
        if (!dlg.open) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); showAt(currentIndex - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); showAt(currentIndex + 1); }
        if (e.key === "Escape") { dlg.close(); }
      });

      function renderTabs(categories) {
        tabsEl.innerHTML = "";
        const counts = new Map();
        for (const p of (all?.photos || [])) counts.set(p.category, (counts.get(p.category) || 0) + 1);
        const allCount = (all?.photos || []).length;
        const allCats = ["All photos", ...categories];
        for (const c of allCats) {
          const count = c === "All photos" ? allCount : (counts.get(c) || 0);
          const b = document.createElement("button");
          b.className = "tab";
          b.type = "button";
          b.dataset.cat = c;
          b.textContent = \`\${c} (\${count})\`;
          b.setAttribute("aria-pressed", c === active ? "true" : "false");
          b.addEventListener("click", () => setActive(c));
          tabsEl.appendChild(b);
        }
      }

      const io = ("IntersectionObserver" in window)
        ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const img = e.target;
            const src = img.dataset.src;
            if (src) img.src = src;
            io.unobserve(img);
          }
        }, { rootMargin: "600px 0px" })
        : null;

      function renderGrid() {
        if (!all) return;
        const photos = all.photos.filter((p) => active === "All photos" ? true : p.category === active);
        gridEl.innerHTML = "";
        for (const p of photos) {
          const card = document.createElement("div");
          card.className = "card " + (p.is_portrait ? "portrait" : "landscape");
          const img = document.createElement("img");
          img.loading = "lazy";
          img.decoding = "async";
          img.fetchPriority = "low";
          img.src = PLACEHOLDER_SRC;
          img.dataset.src = p.thumb;
          img.alt = "";
          img.addEventListener("click", () => openDialog(p));
          if (io) io.observe(img); else img.src = p.thumb;
          const hint = document.createElement("div");
          hint.className = "zoomhint";
          hint.setAttribute("aria-hidden", "true");
          hint.textContent = "🔍";
          const cap = document.createElement("div");
          cap.className = "cap";
          const a = document.createElement("a");
          a.className = "btn";
          a.href = p.original;
          a.download = (p.title || p.id || "photo") + ".jpg";
          a.innerHTML = \`
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 17v3h16v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Download</span>
          \`;
          cap.appendChild(a);
          card.appendChild(img);
          card.appendChild(hint);
          card.appendChild(cap);
          gridEl.appendChild(card);
        }
      }

      async function main() {
        const res = await fetch("./photos.json", { cache: "no-cache" });
        all = await res.json();
        renderTabs(all.categories || []);
        setActive("All photos", { scrollToGrid: false });
        didInit = true;
      }
      main().catch((e) => {
        console.error(e);
      });
    </script>
  </body>
</html>`;
}

function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const photos = mustReadJson(path.join(PUBLIC_DIR, "photos.json"));
  const title = process.env.SITE_TITLE || "Reimagine 2026 Photo";
  fs.writeFileSync(INDEX_HTML, renderIndex({ title }), "utf8");
  console.log(`Built public/index.html (photos=${photos.photos?.length || 0})`);
}

main();
