import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { loadDotEnv, mustGetEnv } from "./env.js";
import { larkApi } from "./lark.js";

loadDotEnv();

const PHOTO_SOURCE = (process.env.PHOTO_SOURCE || process.env.DATA_SOURCE || "base").trim().toLowerCase();
const CATEGORIES = (process.env.CATEGORIES || "Foyer,Main session,Room 1 - Ops track,Room 2 - Tech track")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CATEGORY_RENAMES = new Map([
  ["First session", "Main session"],
  ["Room 1", "Room 1 - Ops track"],
  ["Room 2", "Room 2 - Tech track"]
]);

function normalizeCategoryName(name) {
  const trimmed = String(name || "").trim();
  return CATEGORY_RENAMES.get(trimmed) || trimmed;
}

function parseNamedPairs(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((kv) => {
      const eq = kv.indexOf("=");
      if (eq === -1) return null;
      const name = kv.slice(0, eq).trim();
      const id = kv.slice(eq + 1).trim();
      return name && id ? { name: normalizeCategoryName(name), id } : null;
    })
    .filter(Boolean);
}

function resolvePhotoSource() {
  if (PHOTO_SOURCE === "auto") {
    return (process.env.DRIVE_FOLDERS || process.env.DRIVE_FOLDER_TOKEN || process.env.DRIVE_FOLDER_TOKENS)
      ? "drive"
      : "base";
  }
  if (PHOTO_SOURCE === "base" || PHOTO_SOURCE === "bitable") return "base";
  if (PHOTO_SOURCE === "drive" || PHOTO_SOURCE === "folder") return "drive";
  throw new Error(`Invalid PHOTO_SOURCE: ${PHOTO_SOURCE}. Use base, drive, or auto.`);
}

// Support either:
// - single table: BITABLE_TABLE_ID=tblxxx (legacy)
// - multi tables: BITABLE_TABLES="Foyer=tbl...,Main session=tbl...,Room 1=tbl...,Room 2=tbl..."
function parseTablesEnv() {
  const tablesRaw = (process.env.BITABLE_TABLES || "").trim();
  if (tablesRaw) {
    const pairs = parseNamedPairs(tablesRaw);
    if (pairs.length) return pairs;
  }

  const legacyId = (process.env.BITABLE_TABLE_ID || "").trim();
  if (!legacyId) throw new Error("Missing env: BITABLE_TABLE_ID (or BITABLE_TABLES)");
  return [{ name: "All photos", id: legacyId }];
}

// Support either:
// - single folder: DRIVE_FOLDER_TOKEN=fldxxx
// - multi folders: DRIVE_FOLDERS="Foyer=fld...,Main session=fld..."
function parseDriveFoldersEnv() {
  const foldersRaw = (process.env.DRIVE_FOLDERS || process.env.DRIVE_FOLDER_TOKENS || "").trim();
  if (foldersRaw) {
    const pairs = parseNamedPairs(foldersRaw);
    if (pairs.length) return pairs;
  }

  const folderToken = (process.env.DRIVE_FOLDER_TOKEN || "").trim();
  if (!folderToken) throw new Error("Missing env: DRIVE_FOLDER_TOKEN (or DRIVE_FOLDERS)");
  const category = normalizeCategoryName(process.env.DRIVE_CATEGORY || CATEGORIES[0] || "All photos");
  return [{ name: category, id: folderToken }];
}

const OUT_PUBLIC_DIR = path.resolve(process.cwd(), "public");
const OUT_ORIGINAL_DIR = path.join(OUT_PUBLIC_DIR, "photos", "original");
const OUT_THUMB_DIR = path.join(OUT_PUBLIC_DIR, "photos", "thumb");
const OUT_META_DIR = path.resolve(process.cwd(), ".cache");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeExtFromName(name = "") {
  const ext = path.extname(name).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  return "";
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

async function listAllRecords(appToken, tableId) {
  const records = [];
  let pageToken = undefined;
  for (;;) {
    const { json } = await larkApi(
      `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        query: { page_token: pageToken, page_size: 500 },
        body: JSON.stringify({})
      }
    );

    const items = json?.data?.items || [];
    for (const r of items) records.push(r);

    pageToken = json?.data?.page_token;
    if (!pageToken) break;
  }
  return records;
}

async function listDriveFolderChildren(folderToken) {
  const files = [];
  let pageToken = undefined;
  for (;;) {
    const { json } = await larkApi("/open-apis/drive/v1/files", {
      query: { folder_token: folderToken, page_token: pageToken, page_size: 200 }
    });

    const data = json?.data || {};
    const items = data.files || data.items || [];
    for (const item of items) files.push(item);

    pageToken = data.next_page_token || data.page_token;
    if (!pageToken || data.has_more === false) break;
  }
  return files;
}

async function downloadMedia(fileToken, destPath) {
  const { res } = await larkApi(`/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Download media failed: http=${res.status} ${txt}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function downloadDriveFile(fileToken, destPath) {
  try {
    await downloadMedia(fileToken, destPath);
    return;
  } catch (mediaError) {
    try {
      const { res } = await larkApi(`/open-apis/drive/v1/files/${encodeURIComponent(fileToken)}/download`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Download drive file failed: http=${res.status} ${txt}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      return;
    } catch (fileError) {
      throw new Error(`${mediaError.message}; ${fileError.message}`);
    }
  }
}

async function makeThumb(originalPath, thumbPath) {
  await sharp(originalPath)
    .rotate()
    .resize({ width: 960, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(thumbPath);
}

function getFirstAttachment(fields, photoField) {
  const v = fields?.[photoField];
  if (!v) return null;
  const list = Array.isArray(v) ? v : [v];
  const first = list[0];
  if (!first?.file_token) return null;
  return first;
}

async function fetchFromBase() {
  const BITABLE_APP_TOKEN = mustGetEnv("BITABLE_APP_TOKEN");
  const PHOTO_FIELD = mustGetEnv("BITABLE_PHOTO_FIELD");
  const CATEGORY_FIELD = process.env.BITABLE_CATEGORY_FIELD || "";
  const tables = parseTablesEnv();
  const allRecords = [];
  for (const t of tables) {
    const recs = await listAllRecords(BITABLE_APP_TOKEN, t.id);
    for (const r of recs) allRecords.push({ ...r, __table_name: t.name, __table_id: t.id });
  }

  const out = {
    generated_at: new Date().toISOString(),
    source: "base",
    categories: tables.length > 1 ? tables.map((t) => normalizeCategoryName(t.name)) : [...CATEGORIES],
    photos: []
  };

  function pickCategoryFromBaseField(fields) {
    if (!CATEGORY_FIELD) return null;
    const raw = fields?.[CATEGORY_FIELD];
    const val = Array.isArray(raw) ? raw[0] : raw;
    const text =
      typeof val === "string"
        ? val
        : val && typeof val === "object" && typeof val.text === "string"
          ? val.text
          : "";
    const trimmed = text.trim();
    if (!trimmed) return null;
    const normalized = normalizeCategoryName(trimmed);
    return CATEGORIES.includes(normalized) ? normalized : null;
  }

  for (const r of allRecords) {
    const recordId = r?.record_id;
    const fields = r?.fields || {};
    const attachment = getFirstAttachment(fields, PHOTO_FIELD);
    if (!recordId || !attachment) continue;
    const category = tables.length > 1 ? normalizeCategoryName(r.__table_name) : pickCategoryFromBaseField(fields);
    if (!category) continue;

    const fileToken = attachment.file_token;
    const ext = safeExtFromName(attachment.name) || ".jpg";
    const stableId = sha1(`${recordId}:${fileToken}`);
    const originalRel = `photos/original/${stableId}${ext}`;
    const thumbRel = `photos/thumb/${stableId}.jpg`;
    const originalAbs = path.join(OUT_PUBLIC_DIR, originalRel);
    const thumbAbs = path.join(OUT_PUBLIC_DIR, thumbRel);

    if (!fs.existsSync(originalAbs)) {
      await downloadMedia(fileToken, originalAbs);
    }
    if (!fs.existsSync(thumbAbs)) {
      await makeThumb(originalAbs, thumbAbs);
    }
    const meta = await sharp(originalAbs).metadata();
    const width = typeof meta.width === "number" ? meta.width : null;
    const height = typeof meta.height === "number" ? meta.height : null;
    const isPortrait = !!(width && height && height > width);

    out.photos.push({
      id: stableId,
      category,
      title: fields?.title || fields?.Title || attachment.name || "",
      // IMPORTANT: Use relative paths so GitHub Pages subpaths work
      original: `./${originalRel}`,
      thumb: `./${thumbRel}`,
      width,
      height,
      is_portrait: isPortrait,
      record_id: recordId
    });
  }

  return { out, raw: allRecords, rawFile: "records.raw.json" };
}

function getDriveFileToken(file) {
  return file?.file_token || file?.token || file?.fileToken;
}

function getDriveFileName(file) {
  return file?.name || file?.title || file?.file_name || "";
}

function getDriveFileType(file) {
  return String(file?.type || file?.file_type || file?.mime_type || "").toLowerCase();
}

function isDriveFolder(file) {
  return getDriveFileType(file) === "folder";
}

function isDriveImage(file) {
  const name = getDriveFileName(file);
  const ext = safeExtFromName(name);
  const type = getDriveFileType(file);
  return !!ext || type.startsWith("image/");
}

async function collectDriveFiles(folder, { recursive }) {
  const out = [];
  const children = await listDriveFolderChildren(folder.id);
  for (const child of children) {
    const token = getDriveFileToken(child);
    if (!token) continue;
    if (recursive && isDriveFolder(child)) {
      const nested = await collectDriveFiles({ ...folder, id: token }, { recursive });
      out.push(...nested);
      continue;
    }
    if (!isDriveImage(child)) continue;
    out.push({ ...child, __folder_name: folder.name, __folder_id: folder.id });
  }
  return out;
}

async function fetchFromDrive() {
  const folders = parseDriveFoldersEnv();
  const recursive = /^(1|true|yes)$/i.test(process.env.DRIVE_RECURSIVE || "");
  const allFiles = [];
  for (const folder of folders) {
    const children = await listDriveFolderChildren(folder.id);
    for (const child of children) {
      const token = getDriveFileToken(child);
      if (!token) continue;
      if (recursive && isDriveFolder(child)) {
        const nested = await collectDriveFiles({ ...folder, id: token }, { recursive });
        for (const f of nested) allFiles.push({ ...f, __folder_name: folder.name, __folder_id: folder.id });
        continue;
      }
      if (!isDriveImage(child)) continue;
      allFiles.push({ ...child, __folder_name: folder.name, __folder_id: folder.id });
    }
  }

  const categories = folders.map((f) => normalizeCategoryName(f.name));
  const out = {
    generated_at: new Date().toISOString(),
    source: "drive",
    categories,
    photos: []
  };

  for (const file of allFiles) {
    const fileToken = getDriveFileToken(file);
    const fileName = getDriveFileName(file);
    const category = normalizeCategoryName(file.__folder_name);
    if (!fileToken || !category) continue;

    const ext = safeExtFromName(fileName) || ".jpg";
    const stableId = sha1(`drive:${file.__folder_id}:${fileToken}`);
    const originalRel = `photos/original/${stableId}${ext}`;
    const thumbRel = `photos/thumb/${stableId}.jpg`;
    const originalAbs = path.join(OUT_PUBLIC_DIR, originalRel);
    const thumbAbs = path.join(OUT_PUBLIC_DIR, thumbRel);

    if (!fs.existsSync(originalAbs)) {
      await downloadDriveFile(fileToken, originalAbs);
    }
    if (!fs.existsSync(thumbAbs)) {
      await makeThumb(originalAbs, thumbAbs);
    }
    const meta = await sharp(originalAbs).metadata();
    const width = typeof meta.width === "number" ? meta.width : null;
    const height = typeof meta.height === "number" ? meta.height : null;
    const isPortrait = !!(width && height && height > width);

    out.photos.push({
      id: stableId,
      category,
      title: fileName,
      original: `./${originalRel}`,
      thumb: `./${thumbRel}`,
      width,
      height,
      is_portrait: isPortrait,
      file_token: fileToken
    });
  }

  return { out, raw: allFiles, rawFile: "drive.files.raw.json" };
}

async function main() {
  ensureDir(OUT_ORIGINAL_DIR);
  ensureDir(OUT_THUMB_DIR);
  ensureDir(OUT_META_DIR);

  const source = resolvePhotoSource();
  const { out, raw, rawFile } = source === "drive" ? await fetchFromDrive() : await fetchFromBase();

  out.photos.sort(
    (a, b) =>
      (a.category || "").localeCompare(b.category || "") || (a.title || "").localeCompare(b.title || "")
  );

  fs.writeFileSync(path.join(OUT_PUBLIC_DIR, "photos.json"), JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT_META_DIR, rawFile), JSON.stringify(raw, null, 2), "utf8");

  console.log(`Fetched ${out.photos.length} photos from ${source}. Output: public/photos.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
