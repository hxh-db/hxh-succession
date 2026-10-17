const DATA = {
  characters: "data/characters.json?v=20261016-events",
  characterTags: "data/character_tags.json?v=20261008c",
  characterImages: "data/character_images.json?v=20261008b",
  countOnlyCharacters: "data/count_only_characters.json?v=20261011f",
  events: "data/events.json?v=20261017-eyes",
  openQuestions: "data/open_questions.json?v=20261008d",
  alliances: "data/alliances.json?v=20261002c",
  spiritBeasts: "data/spirit_beasts.json?v=20261016-events",
  factions: "data/factions.json?v=20261008q",
  mafia: "data/mafia.json?v=20261016-events",
  sources: "data/sources.json?v=20261017-eyes",
  personnelSnapshots: "data/personnel_snapshots.json?v=20261013b",
  initialPersonnel: "data/intake/initial_personnel_review_20261013.json?v=20261014a",
  personnelRoster: "data/personnel_roster.json?v=20261014a"
};

let charactersData = [];
let sourcesData = [];
let viewLinksReady = false;
const initialViewUrl = new URL(location.href);
const siteRootUrl = new URL("./", initialViewUrl);
// Pin relative assets to the site root when pushState changes the document URL.
const assetBase = document.createElement("base");
assetBase.href = siteRootUrl.href;
document.head.prepend(assetBase);
let countOnlyCharacterIds = new Set();
let personnelRosterData = {members: [], later: [], queen_projections: []};

function isDirectoryCharacter(character) {
  return !character.roster_projection && (!countOnlyCharacterIds.has(character.id)
    || personnelRosterData.members.some(member => member.character_id === character.id))
    && character.verification_status !== "unverified";
}

function getPersonnelPeriod() { return document.getElementById("characterPeriodFilter")?.value || "all"; }
function getPersonnelEvents() {
  const chapter = PersonnelRoster.chapterFor(getPersonnelPeriod(), Math.max(...eventsData.map(event => event.chapter)));
  return chapter === null ? eventsData : eventsData.filter(event => event.chapter <= chapter);
}
function getPersonnelSelection(queen = null) {
  return PersonnelRoster.select(personnelRosterData, charactersData, {period: getPersonnelPeriod(), queen,
    latest: Math.max(...eventsData.map(event => event.chapter)), events: eventsData});
}
let princesData = [];
let bodyguardsData = [];
let eventsData = [];
let openQuestionsData = [];
let inferredTimePlacements = new Map();
let spiritBeastsData = [];
let factionsData = [];
let alliancesData = [];
let mafiaData = [];
let personnelSnapshotsData = [];
let initialPersonnelData = null;
let filteredEventsData = [];
// 原作画像がなく出来事を登録していない話。0件を「対象外」と誤解されないよう、表示で明示する。
const UNCOLLECTED_CHAPTERS = new Map([[396, "原作画像未提供"], [397, "原作画像未提供"]]);
const UNCOLLECTED_RANGE_LABEL = "第396〜397話は未収録（原作画像未提供）";
function getUncollectedChapterMessage() {
  const chapter = Number(document.getElementById("chapterFilter")?.value);
  return UNCOLLECTED_CHAPTERS.has(chapter) ? `第${chapter}話は未収録です（${UNCOLLECTED_CHAPTERS.get(chapter)}）。出来事は登録していません。` : null;
}
let activeTimelineView = "schedule";
let timelineVisibleCount = 30;
let activeTimelinePeriodId = "day-1";
let activeCharacterAffiliation = null;
let activeCharacterTags = new Map();
let characterTagDefinitions = new Map();
let characterTagsById = new Map();
let confirmedKillsById = new Map();
let activeCharacterSection = "all";
let activeCharacterSubgroup = null;
let activeCharacterView = "cards";
let spoilersRevealed = false;
let currentCharacterResults = [];
let modalReturnFocus = null;
let PRINCE_MAP = {}; // 王子の正式名 → { rank, short }
let CHAR_MAP = {}; // id → character
const LOCAL_DRAFTS_KEY = "hxh-succession-local-drafts-v1";
// ファイル保存用の API はローカルサーバー（local_server.py）だけにある。公開サイトでは問い合わせない（404 を出さない）。
const LOCAL_DRAFTS_API = ["127.0.0.1", "localhost"].includes(location.hostname) ? "api/drafts" : null;
// 完成までは公開サイトでもメモ・編集機能を出す（メモはブラウザに保存）。一般公開するときは false にする。
const MEMO_EDITOR_ON_PUBLIC_SITE = true;
function memoEditorEnabled() {
  return draftStorageMode === "file" || MEMO_EDITOR_ON_PUBLIC_SITE;
}
const REOPEN_DETAIL_KEY = "hxh-succession-reopen-detail-v1";
const SPOILER_VISIBILITY_KEY = "hxh-succession-spoilers-revealed-v1";
const DRAFT_IMPORT_STATUS_KEY = "hxh-succession-draft-import-status-v1";
let localDrafts = { version: 1, items: {} };
let draftStorageMode = "browser";
let draftFileHealthy = false;
let pendingDraftMigration = false;
let draftSaveQueue = Promise.resolve();
const originalRecords = new Map();

const LOCAL_EDIT_FIELDS = {
  event: [
    { key: "description", label: "出来事", kind: "textarea", required: true },
    { key: "day", label: "日（空欄は未設定）", kind: "number" },
    { key: "time_start", label: "確定時刻", kind: "time" },
    { key: "time_estimate", label: "推測時刻", kind: "time" },
    { key: "location", label: "場所", kind: "text" },
    { key: "type", label: "種別", kind: "text" },
    { key: "notes", label: "詳細・備考", kind: "textarea" }
  ],
  prince: [
    { key: "room", label: "部屋", kind: "text" },
    { key: "status", label: "状態", kind: "text" },
    { key: "nen_ability", label: "本人の念能力", kind: "textarea" },
    { key: "notes", label: "備考", kind: "textarea" }
  ],
  bodyguard: [
    { key: "room", label: "現在地", kind: "text" },
    { key: "status", label: "状態", kind: "text" },
    { key: "role", label: "役割", kind: "text" },
    { key: "nen_ability", label: "能力", kind: "textarea" },
    { key: "notes", label: "備考", kind: "textarea" }
  ],
  spiritBeast: [
    { key: "appearance", label: "外見・形態", kind: "textarea" },
    { key: "nen_type", label: "念系統", kind: "text" },
    { key: "ability", label: "能力", kind: "textarea" }
  ],
  guide: [],
  theory: []
};

function localRecordKey(record, category) {
  return `${category}:${category === "spiritBeast" ? record.prince : record.id}`;
}

function buildLocalEventRecord(values, id, chapterOrder = 1) {
  if (!/^LOCAL-[a-zA-Z0-9-]+$/.test(id)) throw new Error("追加した出来事のIDが不正です。");
  if (typeof values.description !== "string" || !values.description.trim()) throw new Error("出来事を入力してください。");
  if (!Number.isInteger(values.chapter) || values.chapter < 1) throw new Error("話数は1以上の整数で入力してください。");
  if (values.day !== null && (!Number.isInteger(values.day) || values.day < 0 || values.day > 12)) throw new Error("日は0〜12の整数か空欄にしてください。");
  if (values.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.time)) throw new Error("時刻は00:00〜23:59で入力してください。");
  if (!["estimated", "confirmed"].includes(values.timeCertainty)) throw new Error("時刻の確度を選んでください。");
  if (!Array.isArray(values.characters) || values.characters.some((id) => typeof id !== "string")) throw new Error("関係人物の形式が不正です。");
  const record = {
    id, chapter: values.chapter, chapter_order: chapterOrder,
    chapter_title: typeof values.chapter_title === "string" ? values.chapter_title : null,
    description: values.description.trim(), day: values.day,
    date_certainty: values.day === null ? "unknown" : "confirmed",
    time_start: values.time && values.timeCertainty === "confirmed" ? values.time : null,
    time_end: null, time_inference: false,
    is_estimate: Boolean(values.is_estimate),
    characters: [...new Set(values.characters)],
    location: String(values.location || "").trim() || null,
    type: String(values.type || "その他").trim() || "その他",
    notes: String(values.notes || "").trim(),
    chronology_kind: "event", local_created: true,
    revealed_facts: [], mysteries: []
  };
  if (values.time && values.timeCertainty === "estimated") record.time_estimate = values.time;
  return record;
}

function validateCreatedEvent(record, key) {
  if (!record || typeof record !== "object" || key !== `event:${record.id}` || (record.time_start && record.time_estimate)) {
    throw new Error("追加した出来事の形式が不正です。");
  }
  if (!Number.isInteger(record.chapter_order) || record.chapter_order < 1) throw new Error("追加した出来事の順序が不正です。");
  const safe = buildLocalEventRecord({ ...record, time: record.time_start || record.time_estimate || "",
    timeCertainty: record.time_start ? "confirmed" : "estimated" }, record.id, record.chapter_order);
  const knownIds = new Set(charactersData.map((character) => character.id));
  if (safe.characters.some((id) => !knownIds.has(id))) throw new Error("追加した出来事に未登録の人物が指定されています。");
  return safe;
}

function appendCreatedEvents(events) {
  const existingIds = new Set(events.map((event) => event.id));
  Object.entries(localDrafts.items).forEach(([key, draft]) => {
    if (!draft.createdRecord) return;
    try {
      const record = validateCreatedEvent(draft.createdRecord, key);
      if (existingIds.has(record.id)) return;
      events.push(record);
      existingIds.add(record.id);
    } catch (error) {
      // 壊れたブラウザ控えがあっても、元の控えを残して他の出来事を表示する。
      console.warn("追加した出来事を読み込めません", key, error);
    }
  });
}

async function loadLocalDrafts() {
  let browserDrafts = { version: 1, items: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) || "null");
    if (saved?.version === 1 && saved.items && typeof saved.items === "object" && !Array.isArray(saved.items)) {
      browserDrafts = saved;
    }
  } catch (error) {
    console.warn("ローカル編集の読み込みに失敗しました", error);
  }
  localDrafts = browserDrafts;
  try {
    if (!LOCAL_DRAFTS_API) return;
    const response = await fetch(LOCAL_DRAFTS_API, { cache: "no-store" });
    if (!response.ok) return;
    const serverPayload = await response.json();
    const serverItems = validateDraftImport(serverPayload);
    const serverSavedAt = Date.parse(serverPayload.exportedAt || "") || 0;
    const merged = { ...serverItems };
    for (const [key, draft] of Object.entries(browserDrafts.items)) {
      const browserUpdatedAt = Date.parse(draft.updatedAt || "") || 0;
      if ((!merged[key] && browserUpdatedAt > serverSavedAt)
        || (merged[key] && browserUpdatedAt > (Date.parse(merged[key].updatedAt || "") || 0))) {
        merged[key] = draft;
      }
    }
    localDrafts = { version: 1, items: merged };
    pendingDraftMigration = JSON.stringify(merged) !== JSON.stringify(serverItems);
    draftStorageMode = "file";
    draftFileHealthy = true;
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(localDrafts));
  } catch (error) {
    console.warn("PC上のメモファイルを読み込めませんでした", error);
  }
}

async function saveLocalDrafts() {
  let browserSaved = false;
  try {
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(localDrafts));
    browserSaved = true;
  } catch (error) {
    console.warn("ブラウザ内のメモ保存に失敗しました", error);
  }
  if (draftStorageMode !== "file") return browserSaved;
  const snapshot = JSON.stringify(buildDraftExport());
  draftSaveQueue = draftSaveQueue.catch(() => {}).then(async () => {
    const response = await fetch(LOCAL_DRAFTS_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: snapshot
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  });
  try {
    const saved = await draftSaveQueue;
    draftFileHealthy = true;
    updateDraftStorageStatus();
    return saved;
  } catch (error) {
    draftFileHealthy = false;
    updateDraftStorageStatus();
    console.warn("PC上のメモファイルへ保存できませんでした", error);
    return false;
  }
}

function buildDraftExport() {
  const records = [
    ...charactersData.map((record) => ({ record, category: record.type === "prince" ? "prince" : "bodyguard" })),
    ...eventsData.map((record) => ({ record, category: "event" })),
    ...spiritBeastsData.map((record) => ({ record, category: "spiritBeast" })),
    ...getGuideMemoRecords().map((record) => ({ record, category: "guide" }))
  ];
  const labels = new Map(records.map(({ record, category }) => [
    localRecordKey(record, category), record.name || record.description || record.id
  ]));
  return {
    format: "hxh-succession-local-drafts",
    version: 1,
    exportedAt: new Date().toISOString(),
    items: localDrafts.items,
    entries: Object.entries(localDrafts.items).map(([key, draft]) => ({
      key, title: labels.get(key) || draft.title || draft.createdRecord?.description || key, memo: draft.memo || "", edits: draft.edits || {}, isNew: Boolean(draft.createdRecord), updatedAt: draft.updatedAt || null
    }))
  };
}

function validateDraftImport(payload) {
  if (payload?.format !== "hxh-succession-local-drafts" || payload.version !== 1 ||
      !payload.items || typeof payload.items !== "object" || Array.isArray(payload.items)) {
    throw new Error("このサイトのメモJSONではありません。");
  }
  const items = {};
  for (const [key, draft] of Object.entries(payload.items)) {
    const category = key.split(":")[0];
    if (!LOCAL_EDIT_FIELDS[category] || !key.includes(":") ||
        !draft || typeof draft !== "object" || Array.isArray(draft)) {
      throw new Error("メモJSONの項目に不正な形式があります。");
    }
    const safe = {};
    if (category === "theory" && typeof draft.title === "string") safe.title = draft.title;
    if (draft.createdRecord !== undefined) safe.createdRecord = validateCreatedEvent(draft.createdRecord, key);
    if (typeof draft.memo === "string") safe.memo = draft.memo;
    if (typeof draft.updatedAt === "string") safe.updatedAt = draft.updatedAt;
    if (draft.edits !== undefined) {
      if (!draft.edits || typeof draft.edits !== "object" || Array.isArray(draft.edits)) {
        throw new Error("編集内容の形式が正しくありません。");
      }
      safe.edits = {};
      for (const field of LOCAL_EDIT_FIELDS[category]) {
        if (!Object.hasOwn(draft.edits, field.key)) continue;
        const value = draft.edits[field.key];
        if (field.kind === "number" ? value !== null && !Number.isInteger(value)
          : value !== null && typeof value !== "string") {
          throw new Error("編集内容の値が正しくありません。");
        }
        safe.edits[field.key] = value;
      }
      if (category === "event" && safe.edits.time_start && safe.edits.time_estimate) {
        throw new Error("確定時刻と推測時刻が同時に入力されています。");
      }
    }
    items[key] = safe;
  }
  return items;
}

function renderDraftOverview() {
  const count = document.getElementById("draftCount");
  const list = document.getElementById("draftOverviewList");
  if (!count || !list) return;
  const entries = buildDraftExport().entries
    .filter((item) => item.isNew || item.memo || Object.keys(item.edits).length)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  count.textContent = `（${entries.length}件）`;
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.textContent = "まだメモはありません。";
    list.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const summary = entry.memo || (entry.isNew ? "追加した出来事（このPCに保存）" : `編集した項目：${Object.keys(entry.edits).join("、")}`);
    row.append(title, document.createTextNode(` — ${summary.length > 160 ? `${summary.slice(0, 160)}…` : summary}`));
    list.appendChild(row);
  });
}

function updateDraftStorageStatus() {
  const status = document.getElementById("draftStorageStatus");
  if (!status) return;
  status.textContent = draftStorageMode === "file" && draftFileHealthy
    ? "● PCへの自動保存が有効です。公開データには反映されません。"
    : "⚠ PCへの自動保存は無効です。専用のローカルサイトから開いてください。";
}

function setupDraftTransfer() {
  const exportButton = document.getElementById("exportLocalDrafts");
  const chooseButton = document.getElementById("chooseLocalDrafts");
  const fileInput = document.getElementById("importLocalDrafts");
  const status = document.getElementById("localDraftsTransferStatus");
  updateDraftStorageStatus();
  renderDraftOverview();
  try {
    const importedCount = sessionStorage.getItem(DRAFT_IMPORT_STATUS_KEY);
    if (importedCount) {
      status.textContent = `${importedCount}件を読み込みました。修正メモに反映されています。`;
      sessionStorage.removeItem(DRAFT_IMPORT_STATUS_KEY);
    }
  } catch (error) {
    console.warn("読み込み結果の表示に失敗しました", error);
  }

  exportButton.addEventListener("click", async () => {
    const count = Object.keys(localDrafts.items).length;
    if (!count) {
      status.textContent = "保存済みのメモ・編集はまだありません。";
      return;
    }
    const content = JSON.stringify(buildDraftExport(), null, 2) + "\n";
    const filename = "codex-notes.json";
    try {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = `${count}件のJSONのダウンロードを開始しました。完了後、Codexに保存先を伝えてください。`;
    } catch (error) {
      status.textContent = "ファイルに保存できませんでした。";
      console.warn("メモJSONの保存に失敗しました", error);
    }
  });

  chooseButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const imported = validateDraftImport(JSON.parse(await file.text()));
      const conflicts = Object.keys(imported).filter((key) => Object.hasOwn(localDrafts.items, key)).length;
      if (conflicts && !window.confirm(`${conflicts}件はブラウザ内のメモを上書きします。読み込みますか？`)) {
        status.textContent = "読み込みを取り消しました。";
        return;
      }
      const previous = localDrafts;
      localDrafts = { version: 1, items: { ...previous.items, ...imported } };
      if (!await saveLocalDrafts()) {
        localDrafts = previous;
        localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(previous));
        throw new Error("PCに保存できませんでした。");
      }
      sessionStorage.setItem(DRAFT_IMPORT_STATUS_KEY, String(Object.keys(imported).length));
      window.location.reload();
    } catch (error) {
      status.textContent = `読み込めませんでした：${error.message}`;
    } finally {
      fileInput.value = "";
    }
  });
}

function applyLocalDrafts(records, categoryForRecord) {
  records.forEach((record) => {
    const category = categoryForRecord(record);
    const key = localRecordKey(record, category);
    originalRecords.set(key, { ...record });
    const edits = localDrafts.items[key]?.edits;
    if (!edits || typeof edits !== "object") return;
    LOCAL_EDIT_FIELDS[category].forEach(({ key: field }) => {
      if (Object.hasOwn(edits, field)) record[field] = edits[field];
    });
  });
}

function reopenDetailAfterReload(record, category, view = "modal") {
  try {
    sessionStorage.setItem(REOPEN_DETAIL_KEY, JSON.stringify({
      category,
      id: category === "spiritBeast" ? record.name : record.id,
      view,
      scrollY: window.scrollY
    }));
  } catch (error) {
    console.warn("詳細画面の復元に失敗しました", error);
  }
  window.CharacterRoutes?.prepareReload();
  window.location.reload();
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// ===== 名前フォーマット =====

function buildPrinceMap(princes) {
  princes.forEach((p) => {
    const short = p.name.split("＝")[0];
    PRINCE_MAP[p.name] = { rank: p.rank, short };
  });
}

function buildCharMap(characters) {
  characters.forEach((c) => { CHAR_MAP[c.id] = c; });
}

// キャラID／王子の正式名 → 表示名。それ以外（無名キャラの素の名前文字列）はそのまま
function formatRoyalName(token) {
  if (!token) return token;
  const char = CHAR_MAP[token];
  if (char) {
    if (char.type === "prince") return `第${char.rank}王子${getDisplayName(char)}`;
    if (char.type === "queen") return `第${char.rank}王妃${getDisplayName(char)}`;
    return getDisplayName(char);
  }
  const entry = PRINCE_MAP[token];
  if (entry) return `第${entry.rank}王子${entry.short}`;
  return formatDisplayText(token);
}

function getDisplayName(character) {
  if (!character) return "";
  if (character.display_name) return character.display_name;
  return character.name.replace(/＝ホイコーロ/g, "");
}

function formatDisplayText(value) {
  if (value == null) return value;
  return String(value)
    .replace(/ナスビー(?:＝ホイコーロ)?(?:国王)?/g, "ホイコーロ国王")
    .replace(/ビスケット(?:＝クルーガー)?/g, "ビスケ")
    .replace(/ch(\d+)/gi, "$1話")
    .replace(/[（(]P\d{2}-[A-Z]\d+[）)]/g, "")
    .replace(/ketsu_mochi（血盟主）/g, "ケツモチ")
    .replace(/幻影旅団（スパイダー）/g, "幻影旅団")
    .replace(/＝ホイコーロ/g, "");
}

function formatPublicDetailText(value) {
  if (value == null) return value;
  return formatDisplayText(value)
    .replace(/ユーザー提供の原作画像（[^）]*）(?:で確認|に基づく|を根拠とする)[。]?/g, "")
    .replace(/ユーザー提供の原作画像（[^）]*）で/g, "作中で")
    .replace(/ユーザー提供の原作画像（[^）]*）/g, "作中の描写")
    .replace(/ユーザー提供の原作画像/g, "作中の描写")
    .replace(/原作画像/g, "作中の描写")
    .replace(/原作では/g, "作中では")
    .replace(/^。+/, "")
    .trim();
}

function formatRoomLabel(value) {
  if (value == null || value === "") return null;
  const text = String(value).replace(/\s+/g, "");
  const room = text.match(/(10\d{2})号室?$/)?.[1] || (/^10\d{2}$/.test(text) ? text : null);
  if (room) return `第1層 ${room}号室`;
  return formatLocationLabel(text);
}

function formatAssignment(character) {
  if (!character.camp) return null;
  if (["king", "queen", "prince", "mafia"].includes(character.type)) return null;
  return formatGroupReference(formatDisplayText(character.camp).replace(/陣営$/, ""));
}

function formatGroupReference(value) {
  let result = value;
  [...princesData, ...charactersData.filter((candidate) => candidate.type === "queen")].forEach((royal) => {
    const shortName = getDisplayName(royal);
    const prefix = royal.type === "prince" ? `第${royal.rank}王子` : `第${royal.rank}王妃`;
    if (!result.includes(`${prefix}${shortName}`)) result = result.replaceAll(shortName, `${prefix}${shortName}`);
  });
  return result;
}

function formatAffiliation(character) {
  if (!character.affiliation) return null;
  if (character.type === "soldier") {
    const queenRank = getQueenAffiliationRank(character);
    if (queenRank != null) return `第${queenRank}王妃所属兵`;
    if (character.soldier_category === "王妃所属兵") return "王妃所属兵（所属王妃未特定）";
    const princeRank = getPrinceAffiliationRank(character);
    if (princeRank != null && character.soldier_category === "私設兵") return `第${princeRank}王子私設兵`;
    if (princeRank != null && character.soldier_category === "王室警備兵") return `第${princeRank}王子王室警備兵`;
  }
  let value = formatGroupReference(formatDisplayText(character.affiliation).replace(/陣営$/, ""));
  if (character.type === "mafia") value = value.replace(/（[^）]+）$/, "");
  if (character.soldier_category === "私設兵" && !/私設兵/.test(value)) value += "私設兵";
  if (character.soldier_category === "王妃所属兵" && !/王妃.*兵|所属兵/.test(value)) value += "所属兵";
  return value.replace(/第(\d+)王子[^\s（）・]+私設兵/g, "第$1王子私設兵");
}

function getAffiliationSupplement(character) {
  if (character.type !== "mafia") return null;
  return character.affiliation?.match(/（([^）]+)）$/)?.[1] || null;
}

function getQueenAffiliationRank(character) {
  const text = character.affiliation || "";
  const queen = charactersData.find((candidate) => candidate.type === "queen" && text.includes(getDisplayName(candidate)));
  if (queen) return queen.rank;
  const numbered = text.match(/第([1-8])王妃/)?.[1];
  if (numbered) return Number(numbered);
  const kanjiNumber = text.match(/第([一二三四五六七八])王妃/)?.[1];
  return kanjiNumber ? "一二三四五六七八".indexOf(kanjiNumber) + 1 : null;
}

function getPrinceAffiliationRank(character) {
  const text = character.affiliation || "";
  if (getQueenAffiliationRank(character) != null || /王妃/.test(text)) return null;
  const numbered = text.match(/第(1[0-4]|[1-9])王子/)?.[1];
  if (numbered) return Number(numbered);
  const prince = princesData.find((candidate) => text.includes(getDisplayName(candidate)));
  return prince?.rank ?? null;
}

function getNenClassLabel(character) {
  const first = isNenClassParticipant(character, 1);
  const second = isNenClassParticipant(character, 2);
  if (character.id === "P14-H01") return "第一回・第二回念講習会の講師";
  if (first && second) return "第一回・第二回とも参加";
  if (first) return "第一回念講習会に参加";
  if (second) return "第二回念講習会に参加";
  return null;
}

function isNenClassParticipant(character, round) {
  if (character.id === "P14-H01" || (round === 2 && character.id === "P03-G01")) return false;
  const eventId = round === 1 ? "E369-002" : "E411-003";
  return (eventsData.find((event) => event.id === eventId)?.characters || []).includes(character.id);
}

function formatLocationLabel(value) {
  if (!value) return "場所不明";
  return String(value)
    .replace(/第?([1-5])層\s*/g, "第$1層 ")
    .replace(/(^|[^\d])(10\d{2})(?!号室)/g, "$1$2号室")
    .replace(/\s+([・／])/g, "$1")
    .trim();
}

function getEventDateCertainty(event) {
  return CharacterFacts.dateCertainty(event);
}

function getDateCertaintyLabel(event) {
  return CharacterFacts.dateCertaintyLabel(event);
}

function makeCertaintyBadge(event) {
  if (event.is_estimate) {
    const estimate = document.createElement("span");
    estimate.className = "certainty-badge certainty-estimated";
    estimate.textContent = "推測";
    estimate.title = event.series === "セレモニー退室時刻（10分間隔の仮定）"
      ? "第9王子ハルケンブルグ14:00を基準に、下位王子から10分間隔とするユーザー指定の仮説です（第359話の画像に合わせ、ワブルとカチョウ・フウゲツの順序を一部修正）。原作で退室の分単位の時刻が確定したわけではありません。"
      : event.local_created ? "自分で追加した推測です。根拠は詳細・備考を確認してください。"
      : "作中で明示された事実ではなく、前後の描写から推測した内容です。";
    return estimate;
  }
  const certainty = getEventDateCertainty(event);
  if (certainty === "confirmed") return null;
  const span = document.createElement("span");
  span.className = `certainty-badge certainty-${certainty}`;
  span.textContent = getDateCertaintyLabel(event);
  return span;
}

function getChronologyKind(event) {
  if (event.chronology_kind) return event.chronology_kind;
  const text = `${event.description || ""} ${event.notes || ""}`;
  if (/回想|過去編|時代の出来事/.test(text)) return "flashback";
  if (/図表|内訳|設定|コードネーム|詳細が判明/.test(text)) return "setting";
  if (/時の.*状況|再現される|言及/.test(text)) return "reference";
  return "unknown";
}

function getChronologyKindLabel(kind) {
  return { flashback: "回想", reference: "時系列上の位置のみ判明", setting: "設定・図表", unknown: "完全不明", event: "出来事" }[kind] || "完全不明";
}

function makeChronologyBadge(event) {
  const span = document.createElement("span");
  const kind = getChronologyKind(event);
  span.className = `chronology-kind-badge chronology-${kind}`;
  span.textContent = getChronologyKindLabel(kind);
  return span;
}

// ===== バッジ生成ユーティリティ =====

// "死亡（意識はバルサミルコに憑依）" のような複合ステータス文字列から
// バッジ色・フィルタ判定用の基本カテゴリ（存命/死亡/拘束/不明）を取り出す
function getStatusCategory(status) {
  if (!status) return null;
  if (status.startsWith("死亡")) return "死亡";
  if (status.startsWith("存命")) return "存命";
  if (status.startsWith("拘束")) return "拘束";
  if (status.startsWith("倒れる")) return "不明";
  if (status.startsWith("操作中")) return "不明";
  return "不明";
}

function makeStatusBadge(status) {
  if (!status) return null;
  const span = document.createElement("span");
  span.className = `status-badge status-${getStatusCategory(status)}`;
  span.textContent = status;
  return span;
}

function makeNenBadge(nenType) {
  if (!nenType) return null;
  const span = document.createElement("span");
  span.className = `nen-badge nen-${nenType}`;
  span.textContent = nenType;
  return span;
}

function makeHunterBadge() {
  const span = document.createElement("span");
  span.className = "hunter-badge";
  span.textContent = "ハンター";
  return span;
}

const CHARACTER_TYPE_LABELS = {
  king: "国王",
  prince: "王子",
  queen: "王妃",
  hunter: "ハンター",
  soldier: "兵士",
  attendant: "従事者",
  mercenary: "傭兵",
  expedition_member: "探検隊関係者",
  mafia: "マフィア",
  phantom_troupe: "幻影旅団",
  official: "司法・政府"
};

const CHARACTER_MISSION_TAG_IDS = {
  "護衛": "duty-protection",
  "監視": "duty-surveillance",
  "潜入": "duty-infiltration",
  "調整": "duty-coordination",
  "暗殺": "duty-assassination",
  "呪殺": "duty-curse",
  "従事": "duty-attendance",
  "司法": "duty-judicial",
  "捜査": "duty-investigation",
  "医療": "duty-medical"
};

function makeCharacterTypeBadge(type) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `character-type-badge character-type-${type} character-facet-category`;
  button.textContent = CHARACTER_TYPE_LABELS[type] || type;
  button.title = `「${button.textContent}」の人物を表示`;
  button.addEventListener("click", () => {
    const groupButton = document.querySelector(`#characterCampNav button[data-group-id="${type}"]`);
    if (groupButton) {
      groupButton.click();
      return;
    }
    document.dispatchEvent(new CustomEvent("character-tag-filter", { detail: `type-${type}` }));
  });
  return button;
}

// ===== フィルター用ピル（バッジ型トグル）UI =====
// 既存の<select>を見た目だけピルボタン群に差し替える。差し替え後も同じidを
// 持ち、.valueプロパティと'change'イベントを提供するため、呼び出し側の
// フィルターロジックは変更不要
function pillify(id) {
  const selectEl = document.getElementById(id);
  if (!selectEl || selectEl.tagName !== "SELECT") return;

  const container = document.createElement("div");
  container.className = "pill-filter";
  container.id = id;
  let currentValue = selectEl.value || "all";
  let availability = null;

  function render() {
    container.innerHTML = "";
    Array.from(selectEl.options).forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill" + (opt.value === currentValue ? " active" : "");
      btn.textContent = opt.textContent;
      btn.dataset.value = opt.value;
      if (availability && opt.value !== "all") {
        const count = availability[opt.value] || 0;
        btn.textContent = `${opt.textContent} ${count}`;
        btn.disabled = count === 0 && opt.value !== currentValue;
        btn.title = count === 0 ? "選択中の条件には該当する出来事がありません" : `${count}件`;
      }
      btn.addEventListener("click", () => {
        if (currentValue === opt.value) return;
        currentValue = opt.value;
        render();
        container.dispatchEvent(new Event("change"));
      });
      container.appendChild(btn);
    });
  }

  Object.defineProperty(container, "value", {
    get() { return currentValue; },
    set(v) { currentValue = v; render(); }
  });
  container.setAvailability = (counts) => {
    availability = counts;
    render();
  };

  render();
  selectEl.replaceWith(container);
}

// ===== キャラクターアバター =====

// 顔画像の拡大表示用の情報（人物名と出典）。頭文字アバターには使わない。
function getAvatarZoom(character) {
  if (!character) return null;
  const name = character.type === "prince"
    ? `第${character.rank}王子${getDisplayName(character)}`
    : character.type === "queen"
      ? `第${character.rank}王妃${getDisplayName(character)}`
      : getDisplayName(character);
  const chapter = character.image_source_chapter;
  return { name, caption: chapter ? `${name}（第${chapter}話より）` : name };
}

// 顔画像のアバターを既存のライトボックス（.zoomable-image）で拡大できるようにする。
// imageCrop の背景画像でも、拡大時は data-zoom-src の元画像全体を表示する。
function makeAvatarZoomable(div, imageSrc, zoom) {
  div.classList.add("zoomable-image", "avatar-zoomable");
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  div.setAttribute("aria-label", `${zoom.name}の顔画像を拡大`);
  div.dataset.zoomSrc = imageSrc;
  div.dataset.zoomAlt = `${zoom.name}の顔画像`;
  div.dataset.zoomCaption = zoom.caption || zoom.name;
}

function clearAvatarZoomable(div) {
  div.classList.remove("zoomable-image", "avatar-zoomable");
  div.removeAttribute("tabindex");
  div.removeAttribute("role");
  div.removeAttribute("aria-label");
  delete div.dataset.zoomSrc;
  delete div.dataset.zoomAlt;
  delete div.dataset.zoomCaption;
}

function makeAvatar(label, nenType, imageSrc = null, imageCrop = null, zoom = null) {
  const div = document.createElement("div");
  div.className = "char-avatar";
  if (nenType) {
    div.classList.add(`nen-avatar-${nenType.replace("系", "")}`);
  }
  // 画像の代替テキストは氏名にする（拡大ボタンの名前「◯◯の顔画像を拡大」は makeAvatarZoomable で付ける）。
  // 頭文字だけのアバターは隣に氏名が並ぶ装飾なので、読み上げから外す。
  const showInitials = () => {
    div.textContent = label;
    div.setAttribute("aria-hidden", "true");
    if (label.length >= 3) div.style.fontSize = "0.7rem";
  };
  const imageName = zoom?.name || label;
  if (imageSrc) {
    if (imageCrop) {
      div.setAttribute("role", "img");
      div.setAttribute("aria-label", imageName);
      div.style.backgroundImage = `url("${imageSrc}")`;
      div.style.backgroundRepeat = "no-repeat";
      div.style.backgroundSize = imageCrop.size;
      div.style.backgroundPosition = imageCrop.position;
      if (zoom) makeAvatarZoomable(div, imageSrc, zoom);
      return div;
    }
    const img = document.createElement("img");
    img.alt = imageName;
    img.loading = "lazy";
    img.decoding = "async";
    img.src = imageSrc;
    img.onerror = () => {
      img.remove();
      clearAvatarZoomable(div);
      showInitials();
    };
    div.appendChild(img);
    if (zoom) makeAvatarZoomable(div, imageSrc, zoom);
  } else {
    showInitials();
  }
  return div;
}

function makeBeastImage(src, alt) {
  if (!src) return null;
  const img = document.createElement("img");
  img.className = "beast-image";
  img.alt = alt || "守護霊獣";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = src;
  img.classList.add("zoomable-image");
  img.tabIndex = 0;
  img.setAttribute("role", "button");
  img.setAttribute("aria-label", `${img.alt}を拡大`);
  img.onerror = () => img.remove();
  return img;
}

function makeSourceExcerptGallery(record) {
  const excerpts = (record.reference_images || []).filter((excerpt) => excerpt.image);
  if (!excerpts.length) return null;
  const section = document.createElement("section");
  section.className = "source-excerpt-gallery";
  const heading = document.createElement("h4");
  heading.textContent = "原作の参照場面";
  section.appendChild(heading);
  excerpts.forEach((excerpt) => {
    const figure = document.createElement("figure");
    const caption = formatPublicDetailText(excerpt.caption || "原作の参照画像");
    const img = makeBeastImage(excerpt.image, caption);
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = caption;
    figure.append(img, figcaption);
    section.appendChild(figure);
  });
  return section;
}

function setupImageLightbox() {
  const dialog = document.getElementById("imageLightbox");
  const enlarged = document.getElementById("lightboxImage");
  const caption = document.getElementById("lightboxCaption");
  const close = document.getElementById("lightboxClose");
  const zoom = document.getElementById("lightboxZoom");
  if (!dialog || !enlarged || !caption || !close || !zoom) return;
  let returnFocus = null;
  // img.zoomable-image（資料コマ・守護霊獣）に加え、顔画像アバター（div.zoomable-image + data-zoom-src）も同じ画面で拡大する。
  const open = (img) => {
    const src = img.dataset.zoomSrc || img.currentSrc || img.src;
    if (!src) return;
    returnFocus = img;
    enlarged.src = src;
    enlarged.alt = img.dataset.zoomAlt || img.alt || "拡大画像";
    caption.textContent = img.dataset.zoomCaption || img.title || img.dataset.source || img.alt || "";
    dialog.classList.remove("magnified");
    zoom.setAttribute("aria-pressed", "false");
    zoom.textContent = "＋ さらに拡大";
    dialog.showModal();
    close.focus();
  };
  // キャプチャ段階で処理し、カードの開閉・詳細表示・リンク遷移が同時に起きないようにする。
  const findZoomable = (target) => target.closest?.("img.zoomable-image, .zoomable-image[data-zoom-src]");
  document.addEventListener("click", (event) => {
    const img = findZoomable(event.target);
    if (!img) return;
    event.preventDefault();
    event.stopPropagation();
    open(img);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const img = findZoomable(event.target);
    if (!img) return;
    event.preventDefault();
    event.stopPropagation();
    open(img);
  }, true);
  close.addEventListener("click", () => dialog.close());
  zoom.addEventListener("click", () => {
    const magnified = dialog.classList.toggle("magnified");
    zoom.setAttribute("aria-pressed", String(magnified));
    zoom.textContent = magnified ? "− 全体表示" : "＋ さらに拡大";
  });
  dialog.addEventListener("close", () => {
    enlarged.removeAttribute("src");
    returnFocus?.focus();
  });
}

// ===== キーボード操作：ピル群を1つのタブ停止にまとめる =====
// toolbar パターン＋roving tabindex。Tab では群の中の1つ（選択中、なければ先頭）だけに止まり、
// 矢印キー・Home・End で群の中を移動し、Enter／Space で押す。ボタンの作り直し・表示切替にも追従する。
function setupRovingToolbar(container, label = null) {
  if (!container || container.dataset.roving === "true") return;
  container.dataset.roving = "true";
  container.setAttribute("role", "toolbar");
  if (label && !container.getAttribute("aria-label")) container.setAttribute("aria-label", label);
  let lastFocused = null;
  const items = () => [...container.querySelectorAll("button")].filter((button) => !button.hidden && !button.disabled);
  const refresh = () => {
    const list = items();
    const current = list.find((button) => button === document.activeElement)
      || (list.includes(lastFocused) ? lastFocused : null)
      || list.find((button) => button.getAttribute("aria-pressed") === "true")
      || list[0];
    container.querySelectorAll("button").forEach((button) => {
      const value = button === current ? "0" : "-1";
      if (button.getAttribute("tabindex") !== value) button.setAttribute("tabindex", value);
    });
  };
  container.addEventListener("focusin", (event) => {
    const button = event.target.closest("button");
    if (!button || !container.contains(button)) return;
    lastFocused = button;
    refresh();
  });
  container.addEventListener("keydown", (event) => {
    const list = items();
    const index = list.indexOf(document.activeElement);
    if (index < 0) return;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % list.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + list.length) % list.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    if (next == null) return;
    event.preventDefault();
    lastFocused = list[next];
    refresh();
    list[next].focus();
  });
  new MutationObserver(refresh).observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "disabled", "aria-pressed"] });
  refresh();
}

// ===== カード共通 =====

function createCard(title, items, badges = [], onClick = null, avatar = null) {
  const card = document.createElement("article");
  card.className = "card";
  if (typeof onClick === "function") {
    card.classList.add("clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.addEventListener("click", () => {
      card.focus();
      onClick();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    });
  }

  if (avatar) {
    card.appendChild(avatar);
  }

  const heading = document.createElement("h3");
  heading.textContent = title;
  badges.forEach((badge) => { if (badge) heading.appendChild(badge); });
  card.appendChild(heading);

  const dl = document.createElement("dl");
  items.forEach(({ label, value }) => {
    if (!value && value !== 0) return;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  });
  card.appendChild(dl);
  return card;
}

// ===== 王子一覧 =====

function renderPrinces(princes) {
  const grid = document.getElementById("prince-grid");
  grid.innerHTML = "";
  if (princes.length === 0) {
    grid.textContent = "該当する王子が見つかりませんでした。";
    return;
  }
  princes.forEach((p) => {
    const title = `第${p.rank}王子${getDisplayName(p)}`;
    const items = [
      { label: "年齢", value: p.age != null ? `${p.age}歳` : "不明" },
      { label: "母（王妃）", value: p.queen || "不明" },
      { label: "部屋", value: p.room || "未配置" },
      { label: "本人の念能力", value: p.nen_ability || "不明" },
      { label: "守護霊獣", value: p.spirit_beast_name || "不明" },
      { label: "陣営メモ", value: p.faction_note || "" },
      { label: "備考", value: p.notes || "" }
    ];
    const badges = [
      makeStatusBadge(p.status),
      makeNenBadge(p.nen_type),
      makeEventCountBadge(p, "prince")
    ];
    const avatar = makeAvatar(`第${p.rank}`, p.nen_type, p.image || null, p.image_crop || null, getAvatarZoom(p));
    grid.appendChild(createCard(title, items, badges, () => showDetailModal(p.id, "prince"), avatar));
  });
}

function setupPrinceSearch() {
  const searchInput = document.getElementById("princeSearch");
  const nenFilter = document.getElementById("princeNenFilter");
  const statusFilter = document.getElementById("princeStatusFilter");

  function apply() {
    const q = searchInput.value.trim().toLowerCase();
    const nen = nenFilter.value;
    const st = statusFilter.value;
    const filtered = princesData.filter((p) => {
      const textMatch = !q || [p.name, p.queen, p.room, p.status, p.notes]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const nenMatch = nen === "all" || p.nen_type === nen;
      const statusMatch = st === "all" || getStatusCategory(p.status) === st;
      return textMatch && nenMatch && statusMatch;
    });
    renderPrinces(filtered);
  }

  searchInput.addEventListener("input", apply);
  nenFilter.addEventListener("change", apply);
  statusFilter.addEventListener("change", apply);
}

// ===== 護衛・ハンター一覧 =====

function createBodyguardCard(g) {
  const outside = isOutsidePlacement(g);
  const items = [
    { label: "分類", value: g.soldier_category || "不明" },
    { label: "配置先", value: g.camp || "不明" },
    { label: "所属", value: g.affiliation || "不明" },
    { label: "念系統", value: g.nen_status === "historical_unorganized" ? "この時点の能力情報は未整理" : CharacterFacts.nenTypeLabel(g) },
    { label: "能力", value: g.nen_status === "historical_unorganized" ? "この時点の能力情報は未整理" : g.nen_ability || "不明" },
    { label: "役割", value: g.role },
    { label: "備考", value: g.notes }
  ];
  const badges = [];
  if (g.soldier_category) badges.push(makeCategoryBadge(g.soldier_category));
  if (outside) badges.push(makeOutsidePlacementBadge(g));
  if (g.is_hunter) badges.push(makeHunterBadge());
  badges.push(makeNenBadge(g.nen_type));
  badges.push(makeEventCountBadge(g, "bodyguard"));
  const initial = g.name.slice(0, 2);
  const avatar = makeAvatar(initial, g.nen_type, g.image || null, g.image_crop || null, getAvatarZoom(g));
  const card = document.createElement("article");
  card.className = "compact-person-card";

  const summary = document.createElement("div");
  summary.className = "compact-person-summary";
  summary.appendChild(avatar);

  const identity = document.createElement("div");
  identity.className = "compact-person-identity";
  const heading = document.createElement("h3");
  heading.textContent = g.name;
  const badgeList = document.createElement("div");
  badgeList.className = "compact-person-badges";
  badges.forEach((badge) => { if (badge) badgeList.appendChild(badge); });
  identity.append(heading, badgeList);
  summary.appendChild(identity);
  card.appendChild(summary);

  const details = document.createElement("details");
  details.className = "compact-person-details";
  const detailsToggle = document.createElement("summary");
  detailsToggle.textContent = "詳細";
  details.appendChild(detailsToggle);

  const dl = document.createElement("dl");
  items.forEach(({ label, value }) => {
    if (!value && value !== 0) return;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  });
  details.appendChild(dl);
  details.dataset.localRecordKey = localRecordKey(g, "bodyguard");
  renderLocalEditor(details, g, "bodyguard", "inline");
  card.appendChild(details);

  if (outside) card.classList.add(`outside-${getOutsidePlacementKind(g).cls}-card`);
  return card;
}

// 王妃所属兵＝王妃の意向で配置される「監視」、それ以外（他陣営の私設兵など）は
// 真の雇い主の意図で送り込まれた「潜入」として見た目を分ける
function getOutsidePlacementKind(guard) {
  return guard.soldier_category === "王妃所属兵"
    ? { label: "監視中", icon: "👁️", cls: "watching" }
    : { label: "潜入中", icon: "⚠️", cls: "infiltrating" };
}

function makeOutsidePlacementBadge(guard) {
  const kind = getOutsidePlacementKind(guard);
  const span = document.createElement("span");
  span.className = `outside-placement-badge outside-${kind.cls}`;
  span.textContent = `${kind.icon} ${kind.label}`;
  return span;
}

const CATEGORY_CLASS_MAP = {
  "私設兵": "shisetsuhei",
  "王妃所属兵": "ouhi",
  "王室警備兵": "keibihei",
  "従事者": "juujisha",
  "ハンター（クラピカ経由）": "hunter-kurapika",
  "ハンター（協専）": "hunter-kyousen",
  "ハンター（協会派遣）": "hunter-kyoukai"
};

function makeCategoryBadge(category) {
  const span = document.createElement("span");
  const cls = CATEGORY_CLASS_MAP[category] || "other";
  span.className = `category-badge category-${cls}`;
  span.textContent = category;
  return span;
}

// 陣営名 → 紐づく王子のrank（陣営名が王子camp名と一致しない場合は末尾に回す）
function getCampRank(camp) {
  const p = princesData.find((pr) => pr.camp === camp);
  return p ? p.rank : 999;
}

let bodyguardGroupByCamp = true;
let bodyguardViewMode = "card";

function createBodyguardRow(g) {
  const tr = document.createElement("tr");
  tr.className = "bodyguard-row";
  tr.addEventListener("click", () => showDetailModal(g.id, "bodyguard"));
  const outside = isOutsidePlacement(g);

  const cells = [
    g.name,
    g.soldier_category || "不明",
    g.camp || "不明",
    g.affiliation || "不明",
    g.role || "不明",
    g.nen_status === "historical_unorganized" ? "この時点の能力情報は未整理" : [g.nen_type, g.nen_ability].filter(Boolean).join(" / ") || "不明",
    g.notes || ""
  ];
  cells.forEach((text, i) => {
    const td = document.createElement("td");
    if (i === 1 && g.soldier_category) {
      td.appendChild(makeCategoryBadge(g.soldier_category));
    } else if (i === 3) {
      td.textContent = text;
      if (outside) td.appendChild(makeOutsidePlacementBadge(g));
    } else {
      td.textContent = text;
    }
    tr.appendChild(td);
  });
  return tr;
}

function renderBodyguardsTable(guards, container) {
  const table = document.createElement("table");
  table.className = "bodyguard-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>名前</th><th>分類</th><th>配置先</th><th>所属</th><th>役割</th><th>念系統・能力</th><th>備考</th></tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  guards.forEach((g) => tbody.appendChild(createBodyguardRow(g)));
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderBodyguards(guards) {
  const grid = document.getElementById("bodyguard-grid");
  grid.innerHTML = "";
  grid.classList.toggle("grouped", bodyguardGroupByCamp);
  grid.classList.toggle("table-mode", bodyguardViewMode === "table");
  grid.classList.toggle("compact-person-grid", bodyguardViewMode === "card" && !bodyguardGroupByCamp);
  if (guards.length === 0) {
    grid.textContent = "該当する護衛が見つかりませんでした。";
    return;
  }

  if (!bodyguardGroupByCamp) {
    if (bodyguardViewMode === "table") {
      renderBodyguardsTable(guards, grid);
    } else {
      guards.forEach((g) => grid.appendChild(createBodyguardCard(g)));
    }
    return;
  }

  const groups = guards.reduce((acc, g) => {
    const camp = g.camp || "陣営不明";
    (acc[camp] = acc[camp] || []).push(g);
    return acc;
  }, {});

  Object.keys(groups)
    .sort((a, b) => getCampRank(a) - getCampRank(b))
    .forEach((camp) => {
      const section = document.createElement("div");
      section.className = "camp-group";
      const heading = document.createElement("h3");
      heading.className = "camp-group-title";
      heading.textContent = `${camp}（${groups[camp].length}名）`;
      section.appendChild(heading);

      if (bodyguardViewMode === "table") {
        renderBodyguardsTable(groups[camp], section);
      } else {
        const subGrid = document.createElement("div");
        subGrid.className = "card-grid camp-grid compact-person-grid";
        groups[camp].forEach((g) => subGrid.appendChild(createBodyguardCard(g)));
        section.appendChild(subGrid);
      }

      grid.appendChild(section);
    });
}

function setupBodyguardCategoryFilter() {
  const categoryFilter = document.getElementById("bodyguardCategoryFilter");
  const categories = [...new Set(bodyguardsData.map((g) => g.soldier_category).filter(Boolean))];
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
  pillify("bodyguardCategoryFilter");
}

function setupBodyguardSearch() {
  const searchInput = document.getElementById("bodyguardSearch");
  const hunterFilter = document.getElementById("hunterFilter");
  const groupToggle = document.getElementById("bodyguardGroupToggle");
  const categoryFilter = document.getElementById("bodyguardCategoryFilter");
  const viewModeSelect = document.getElementById("bodyguardViewMode");

  function apply() {
    const q = searchInput.value.trim().toLowerCase();
    const hf = hunterFilter.value;
    const cf = categoryFilter.value;
    bodyguardGroupByCamp = groupToggle.value === "camp";
    bodyguardViewMode = viewModeSelect.value;
    const filtered = bodyguardsData.filter((g) => {
      const textMatch = !q || [g.name, g.camp, g.affiliation, g.nen_ability, g.role, g.notes]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const hunterMatch = hf === "all"
        || (hf === "true" && g.is_hunter)
        || (hf === "false" && !g.is_hunter);
      const categoryMatch = cf === "all" || g.soldier_category === cf;
      return textMatch && hunterMatch && categoryMatch;
    });
    renderBodyguards(filtered);
  }

  searchInput.addEventListener("input", apply);
  hunterFilter.addEventListener("change", apply);
  groupToggle.addEventListener("change", apply);
  categoryFilter.addEventListener("change", apply);
  viewModeSelect.addEventListener("change", apply);
}

// ===== 全キャラクター名鑑 =====

function getKnownParentIds(character) {
  if (Array.isArray(character.parent_ids)) return character.parent_ids;
  if (character.type === "prince") {
    const mother = charactersData.find(
      (candidate) => candidate.type === "queen" && (candidate.children || []).includes(character.id)
    );
    return ["KNG-001", mother?.id].filter(Boolean);
  }
  if (["P05-G01", "P05-G02"].includes(character.id)) return ["BYD-001"];
  return [];
}

function getKnownChildIds(character) {
  if (Array.isArray(character.children)) return character.children;
  if (character.id === "KNG-001") return princesData.map((prince) => prince.id);
  if (character.id === "BYD-001") {
    return charactersData
      .filter((candidate) => ["P05-G01", "P05-G02"].includes(candidate.id))
      .map((candidate) => candidate.id);
  }
  return [];
}

function getRelationshipNames(ids) {
  return ids.map((id) => formatRoyalName(id)).join(" / ");
}

function getBloodRelations(character) {
  const relations = new Map();
  const add = (id, kind, speculative = false) => {
    if (CHAR_MAP[id]) relations.set(id, { id, kind, speculative });
  };
  getKnownParentIds(character).filter((id) => id !== "KNG-001")
    .forEach((id) => add(id, CHAR_MAP[id]?.type === "queen" ? "母" : "親"));
  if (character.type === "queen") {
    (character.children || []).forEach((id) => add(id, "子"));
    charactersData.filter((candidate) => candidate.public_mother_id === character.id)
      .forEach((candidate) => add(candidate.id, "公的な子"));
    charactersData.filter((candidate) => candidate.reported_biological_mother_id === character.id)
      .forEach((candidate) => add(candidate.id, "実子説", true));
  }
  if (character.public_mother_id) add(character.public_mother_id, "公的な母");
  if (character.reported_biological_mother_id) add(character.reported_biological_mother_id, "実母説", true);
  if (character.suggested_father_id) add(character.suggested_father_id, "実父説", true);
  if (character.suggested_child_id) add(character.suggested_child_id, "実子説", true);
  const siblingIds = character.known_half_sibling_ids || (character.known_half_sibling_id ? [character.known_half_sibling_id] : []);
  siblingIds.forEach((id) => add(id, "異母兄弟"));
  (character.known_sibling_ids || []).forEach((id) => add(id, "兄弟（母親の同異は未確認）"));
  return [...relations.values()];
}

function getRelatedPrinceIds(character) {
  if (character.type === "prince") return [character.id];
  if (character.type === "queen") return character.children || [];
  // 所属・応援先・監視/呪殺対象を統合するが、備考の単なる言及は使わない。
  const text = [character.camp, character.affiliation, character.current_assignment,
    character.target, ...(character.target_history || []).map((entry) => entry.target)].filter(Boolean).join(" ");
  const ids = princesData.filter((prince) => {
    const shortName = getDisplayName(prince);
    return text.includes(shortName) || new RegExp(`第0?${prince.rank}王子(?!\\d)`).test(text);
  }).map((prince) => prince.id);
  (characterTagsById.get(character.id) || []).forEach((tagId) => {
    const prince = tagId.match(/^(?:guard|target)-(p\d{2})$/i)?.[1]?.toUpperCase();
    if (prince) ids.push(prince);
  });
  if (character.type === "mafia") {
    const family = character.affiliation || "";
    if (family.startsWith("シュウ＝ウ")) ids.push("P03");
    if (family.startsWith("エイ＝イ")) ids.push("P04");
    if (family.startsWith("シャ＝ア")) ids.push("P07");
  }
  return [...new Set(ids)];
}

function isConfirmedNenUser(character) {
  return CharacterFacts.isConfirmedNenUser(character);
}

function getNenAbilityName(character) {
  if (character.nen_ability_name) return character.nen_ability_name;
  const ability = character.nen_ability || "";
  const named = ability.match(/^([^。：]{2,28}?)(?:（[^）]+）)?[：:]/);
  if (named && !/^(?:詳細不明|念能力者だが詳細不明|念を使用可能|変化系念能力|強化系念能力)/.test(named[1])) {
    return named[1];
  }
  const quoted = ability.match(/^『([^』]+)』/);
  if (quoted) return quoted[1];
  const rubyName = ability.match(/^([^（。：]{2,28})（[^）]+）[。、]/);
  if (rubyName && !/^(?:念を使用可能|念能力者|強化系念能力|変化系念能力|除念)/.test(rubyName[1])) {
    return rubyName[1];
  }
  return "名称未判明";
}

function getCharacterTags(character) {
  const ids = new Set(characterTagsById.get(character.id) || []);
  ids.add(`type-${character.type}`);
  if (character.type === "soldier" && character.soldier_category) {
    ids.add(`soldier-kind-${character.soldier_category}`);
  }
  if (character.type === "soldier" && character.soldier_category === "私設兵") {
    const princeRank = getPrinceAffiliationRank(character);
    if (princeRank) ids.add(`affiliation-p${String(princeRank).padStart(2, "0")}-private`);
  }
  if (character.type === "soldier" && character.soldier_category === "王妃所属兵") {
    const queenRank = getQueenAffiliationRank(character);
    if (queenRank) ids.add(`affiliation-q${String(queenRank).padStart(2, "0")}-guards`);
  }
  if (character.type === "soldier" && character.soldier_category === "私設兵") ids.add("personnel-private-soldier");
  if (character.type === "soldier" && character.soldier_category === "王妃所属兵") ids.add("personnel-queen-soldier");
  if (character.type === "soldier" && character.soldier_category === "王室警備兵") ids.add("personnel-royal-guard");
  if (character.type === "hunter" && character.is_hunter && character.mission === "護衛") {
    ids.add("personnel-association-hunter");
  }
  if (character.type === "mafia" && character.affiliation && character.affiliation !== "不明") {
    ids.add(`mafia-family-${formatAffiliation(character)}`);
  }
  if ((character.soldier_category || "").includes("協専") || (character.affiliation || "").includes("（協専）")) {
    ids.add("hunter-beyond-kyousen");
  }
  if (character.soldier_category === "王室警備兵") ids.add("affiliation-royal-guards");
  if (character.nen_role === "soemono") ids.add("nen-soemono");
  if (character.initial_room) {
    const roomNumber = character.initial_room.match(/10\d{2}/)?.[0];
    if (roomNumber) ids.add(`initial-room-${roomNumber}`);
  }
  if (isConfirmedNenUser(character)) {
    ids.add(character.nen_origin === "nen_class" ? "nen-awakened-in-class" : "nen-user");
  } else {
    ids.add(`nen-${character.nen_status || "unknown"}`);
  }
  if (CHARACTER_MISSION_TAG_IDS[character.mission]) {
    ids.add(CHARACTER_MISSION_TAG_IDS[character.mission]);
  }
  if (/^死亡/.test(character.status || "")) ids.add("status-deceased");
  if (confirmedKillsById.has(character.id)) ids.add("status-killer");
  if (isNenClassParticipant(character, 1)) ids.add("nen-class-1");
  if (isNenClassParticipant(character, 2)) ids.add("nen-class-2");
  if (character.mission === "護衛" && ![...ids].some((id) => id.startsWith("guard-"))) {
    const guardedPrince = princesData.find((prince) => prince.camp === character.camp);
    if (guardedPrince) ids.add(`guard-${guardedPrince.id.toLowerCase()}`);
  }
  if (["監視", "呪殺", "暗殺", "従事"].includes(character.mission) && character.target) {
    const targetId = getPrinceTargetTagId(character.target);
    if (targetId) ids.add(targetId);
    (character.target_history || []).forEach((entry) => {
      const historicalId = getPrinceTargetTagId(entry.target);
      if (historicalId) ids.add(historicalId);
    });
  }
  const parentIds = new Set((character.parent_ids || []).filter((id) => id !== "KNG-001"));
  charactersData.filter((candidate) => candidate.type === "queen" && (candidate.children || []).includes(character.id))
    .forEach((queen) => parentIds.add(queen.id));
  parentIds.forEach((id) => ids.add(id === "Q01" ? "family-q01-child" : `blood-parent-${id.toLowerCase()}`));
  if (getBloodRelations(character).length) ids.add("relation-blood");
  if (character.reported_biological_mother_id) {
    const reportedId = character.reported_biological_mother_id;
    ids.add(reportedId === "Q01" ? "family-q01-child" : `blood-parent-${reportedId.toLowerCase()}`);
    ids.add("relation-blood-reported");
    ids.add(`blood-reported-${reportedId.toLowerCase()}`);
  }
  if (character.public_mother_id) {
    ids.add(`blood-parent-${character.public_mother_id.toLowerCase()}`);
    ids.add("relation-blood-public");
    ids.add(`blood-public-${character.public_mother_id.toLowerCase()}`);
  }
  if (character.suggested_father_id) {
    ids.add("relation-blood-suggested");
    ids.add(`blood-suggested-${character.id.toLowerCase()}-${character.suggested_father_id.toLowerCase()}`);
  }
  if (character.suggested_child_id) {
    ids.add("relation-blood-suggested");
    ids.add(`blood-suggested-${character.suggested_child_id.toLowerCase()}-${character.id.toLowerCase()}`);
  }
  (character.known_half_sibling_ids || (character.known_half_sibling_id ? [character.known_half_sibling_id] : []))
    .forEach((id) => ids.add(`blood-half-sibling-${id.toLowerCase()}`));
  (character.known_sibling_ids || []).forEach((id) => ids.add(`blood-sibling-${id.toLowerCase()}`));
  return [...ids]
    .map((id) => characterTagDefinitions.get(id))
    .filter(Boolean);
}

function getPrinceTargetTagId(target) {
  const prince = princesData.find((candidate) => target === `第${candidate.rank}王子${getDisplayName(candidate)}`);
  return prince ? `target-${prince.id.toLowerCase()}` : null;
}

function getCharacterTagColorClass(tag) {
  return ({ 分類: "category", 兵種: "category", 人員区分: "category", 任務: "mission", 所属: "affiliation", 資格: "affiliation", 初期配置: "guard", 護衛: "guard", 対象: "target", 血縁: "family", 念講習会: "mission", 念: "mission", 状態: "status" })[tag.category] || "other";
}

function getCharacterTagShortLabel(tag) {
  if (tag.label.startsWith("ナスビー")) return formatDisplayText(tag.label.replace(/の子$/, ""));
  if (["護衛", "対象"].includes(tag.category)) return tag.label.match(/^第\d+王子/)?.[0] || tag.label;
  if (tag.id === "status-killer") return "殺害";
  if (tag.id === "blood-parent-byd-001") return "ビヨンド";
  if (tag.id === "blood-public-q02") return "第2王妃（公的・実母未確定）";
  if (tag.id.startsWith("blood-public-")) return `${tag.label.split("（")[0]}（公的）`;
  if (tag.id.startsWith("blood-reported-")) return `${tag.label.split("（")[0]}（実母説・未検証）`;
  if (tag.id.startsWith("blood-half-sibling-")) return tag.label.split("（")[0];
  if (tag.id.startsWith("blood-suggested-")) return "※真偽不明";
  if (tag.category === "血縁") return tag.label.match(/^第\d+王妃/)?.[0] || tag.label.replace(/の子$/, "");
  return tag.label;
}

function makeCharacterTagButton(tag) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `character-structured-tag character-facet-${getCharacterTagColorClass(tag)}`;
  button.textContent = getCharacterTagShortLabel(tag);
  button.title = `「${tag.category}：${tag.label}」の人物を表示`;
  button.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("character-tag-filter", { detail: tag.id }));
  });
  return button;
}

function makeCharacterLinkTag(characterId, colorClass, title) {
  const person = CHAR_MAP[characterId];
  if (!person) return null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `character-structured-tag character-facet-${colorClass}`;
  button.textContent = person.type === "queen" ? `第${person.rank}王妃` : getDisplayName(person).split("＝")[0];
  button.title = title;
  button.addEventListener("click", () => {
    document.querySelector('#characterCampNav button[data-group-id="all"]')?.click();
    const search = document.getElementById("characterSearch");
    search.value = person.name;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const target = [...document.querySelectorAll(".directory-character-card")]
      .find((card) => card.dataset.characterId === characterId);
    if (target) {
      const details = target.querySelector(".directory-character-details");
      if (details) details.open = true;
      target.scrollIntoView({ block: "start" });
    }
  });
  return button;
}

function makeBloodRelationChain(tag, relations, character = null) {
  const chain = document.createElement("span");
  chain.className = "character-tag-chain character-blood-chain";
  chain.appendChild(makeCharacterTagButton(tag));
  const arrow = document.createElement("span");
  arrow.className = "character-tag-arrow";
  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");
  chain.appendChild(arrow);
  relations.forEach((relation, index) => {
    if (index) {
      const plus = document.createElement("span");
      plus.className = "character-tag-arrow";
      plus.textContent = "+";
      plus.setAttribute("aria-hidden", "true");
      chain.appendChild(plus);
    }
    const relative = CHAR_MAP[relation.id];
    const relativeTag = makeCharacterLinkTag(relation.id, "family",
      `${relative.name}の人物カードへ移動（${relation.kind}${relation.speculative ? "・未確定" : ""}）`);
    if (character?.id === "P09" && relation.id === "Q02") {
      relativeTag.textContent = "第2王妃（公的・実母未確定）";
    }
    chain.appendChild(relativeTag);
    if (relation.speculative) {
      const note = document.createElement("span");
      note.className = "character-tag-context";
      note.textContent = "※真偽不明";
      chain.appendChild(note);
    }
  });
  return chain;
}

function makeDeathTagChain(tag, deathRecords) {
  const killers = [...new Map(deathRecords.filter((record) => record.killer && CHAR_MAP[record.killer])
    .map((record) => [record.killer, record])).values()];
  if (!killers.length) return makeCharacterTagButton(tag);
  const chain = document.createElement("span");
  chain.className = "character-tag-chain character-death-chain";
  chain.appendChild(makeCharacterTagButton(tag));
  const arrow = document.createElement("span");
  arrow.className = "character-tag-arrow";
  arrow.textContent = "←";
  arrow.setAttribute("aria-hidden", "true");
  chain.appendChild(arrow);
  killers.forEach((record, index) => {
    if (index) {
      const plus = document.createElement("span");
      plus.className = "character-tag-arrow";
      plus.textContent = "+";
      plus.setAttribute("aria-hidden", "true");
      chain.appendChild(plus);
    }
    chain.appendChild(makeCharacterLinkTag(record.killer, "status",
      `${CHAR_MAP[record.killer].name}の人物カードへ移動（死亡記録${record.chapter ? `・${record.chapter}話` : ""}）`));
  });
  return chain;
}

function makeKillTagChain(tag, victims) {
  const chain = document.createElement("span");
  chain.className = "character-tag-chain character-kill-chain";
  chain.appendChild(makeCharacterTagButton(tag));
  [...new Map(victims.map((record) => [record.id, record])).values()].forEach((record, index) => {
    const separator = document.createElement("span");
    separator.className = "character-tag-arrow";
    separator.textContent = index ? "+" : "→";
    separator.setAttribute("aria-hidden", "true");
    chain.appendChild(separator);
    const target = makeCharacterLinkTag(record.id, "status",
      `${formatRoyalName(record.id)}の人物カードへ移動${record.chapter ? `（${record.chapter}話）` : ""}`);
    if (target) chain.appendChild(target);
  });
  return chain;
}

function makeCharacterTagChain(tags, sharedHead = false) {
  const chain = document.createElement("span");
  chain.className = "character-tag-chain";
  tags.forEach((tag, index) => {
    if (index) {
      const arrow = document.createElement("span");
      arrow.className = "character-tag-arrow";
      arrow.textContent = sharedHead && index > 1 ? "、" : "→";
      arrow.setAttribute("aria-hidden", "true");
      chain.appendChild(arrow);
    }
    chain.appendChild(makeCharacterTagButton(tag));
  });
  return chain;
}

function getCharacterDescriptionParagraphs(character) {
  const notes = formatDisplayText(character.notes)?.trim() || "";
  const role = formatDisplayText(character.role)?.trim() || "";
  const normalizedNotes = notes.replace(/\s/g, "");
  const normalizedRole = role.replace(/\s/g, "");
  const paragraphs = [];
  const sentence = (value) => /[。！？!?]$/.test(value) ? value : `${value}。`;
  const chapterOnly = /^第?\d+話$/.test(notes);
  const detailNotes = character.type === "queen"
    ? notes.replace(new RegExp(`^第${character.rank}王妃。\\s*`), "")
    : notes;
  if (character.type === "prince") {
    const gender = character.gender ? `（${character.gender}）` : "";
    paragraphs.push(`第${character.rank}王子${gender}。`);
  } else if (character.type === "queen") {
    paragraphs.push(`第${character.rank}王妃。`);
  } else if (role && !normalizedNotes.includes(normalizedRole)) {
    paragraphs.push(sentence(role));
  } else if (!notes && !role) {
    const typeLabels = { king: "カキン国王", official: "王位継承戦に関わる関係者", hunter: "ハンター", soldier: "船内の兵士", mafia: "船内で活動するマフィア", phantom_troupe: "幻影旅団員", attendant: "王族に仕える従事者" };
    paragraphs.push(`${typeLabels[character.type] || "関係者"}。`);
  }
  if (detailNotes && !chapterOnly) {
    paragraphs.push(sentence(detailNotes));
  } else if (role) {
    paragraphs.push(sentence(role));
  } else if (chapterOnly) {
    paragraphs.push(`${notes.replace(/^\d/, (digit) => `第${digit}`)}に登場。`);
  }

  const explanation = paragraphs.join(" ");
  if (character.type === "prince") {
    if (character.public_mother_id && character.reported_biological_mother_id
        && !/実母|403話の手紙/.test(explanation)) {
      paragraphs.push(`公的な母は${formatRoyalName(character.public_mother_id)}。第${character.reported_biological_mother_chapter}話の手紙には${formatRoyalName(character.reported_biological_mother_id)}が実母と記されるが、血縁は未検証。`);
    } else {
      const motherId = getKnownParentIds(character).find((id) => CHAR_MAP[id]?.type === "queen");
      if (motherId && !explanation.includes(getDisplayName(CHAR_MAP[motherId]))
          && !explanation.includes(`第${CHAR_MAP[motherId].rank}王妃`)) {
        paragraphs.push(`母は${formatRoyalName(motherId)}。`);
      }
    }
  }
  if (character.type === "queen") {
    const publicChildren = charactersData.filter((candidate) => candidate.public_mother_id === character.id);
    if (publicChildren.length && !publicChildren.every((child) => explanation.includes(getDisplayName(child)))) {
      paragraphs.push(`${publicChildren.map((child) => formatRoyalName(child.id)).join("・")}の公的な母でもある。`);
    }
    const reportedChildren = charactersData.filter((candidate) => candidate.reported_biological_mother_id === character.id);
    if (reportedChildren.length && !/実母|手紙/.test(explanation)) {
      paragraphs.push(`${reportedChildren.map((child) => formatRoyalName(child.id)).join("・")}の実母とする手紙があるが、血縁は未検証。`);
    }
  }
  if (character.suggested_father_id && !/実父|父さん/.test(explanation)) {
    paragraphs.push(`${formatRoyalName(character.suggested_father_id)}が実父である可能性が示唆されるが、確定していない。`);
  }
  if (character.suggested_child_id && !/実子|父さん/.test(explanation)) {
    paragraphs.push(`${formatRoyalName(character.suggested_child_id)}が実子である可能性が示唆されるが、確定していない。`);
  }
  const siblingIds = character.known_half_sibling_ids || (character.known_half_sibling_id
    ? [character.known_half_sibling_id] : []);
  if (siblingIds.length && !/異母兄弟|腹違い/.test(explanation)) {
    paragraphs.push(`${siblingIds.map((id) => formatRoyalName(id)).join("・")}とは異母兄弟にあたる。`);
  }
  const knownSiblingIds = character.known_sibling_ids || [];
  if (knownSiblingIds.length && !knownSiblingIds.every((id) => explanation.includes(getDisplayName(CHAR_MAP[id])))) {
    paragraphs.push(`${knownSiblingIds.map((id) => formatRoyalName(id)).join("・")}とは父を同じくする兄弟だが、互いの母親の同異は未確認。`);
  }
  const beyondParent = getKnownParentIds(character).includes("BYD-001");
  if (beyondParent && !explanation.includes("ビヨンド")) paragraphs.push("ビヨンド＝ネテロの実子。");
  if (character.id === "BYD-001" && !explanation.includes("マカハ")) {
    paragraphs.push("確認済みの実子はロンギとマカハ。王族内にも実子がいることが示されているが、誰かは未確定。");
  }

  return paragraphs.length ? paragraphs : ["人物像を補う記述はまだ確認できていません。確認済みの出来事は下のタイムラインを参照してください。"];
}

function makeAuthorSettingPanel(character) {
  const evidence = character.author_setting;
  if (!evidence) return null;
  const source = sourcesData.find(entry => entry.id === evidence.source_id);
  const section = document.createElement("section");
  section.className = "author-setting-panel";
  const heading = document.createElement("h4");
  heading.textContent = "作者の公式設定資料";
  const scope = document.createElement("p");
  scope.textContent = `確認済み：${evidence.confirmed_fields.join("・")}。${evidence.scope}`;
  section.append(heading, scope);
  if (source?.source_type === "author_official_x" && /^https:\/\/x\.com\//.test(source.url || "")) {
    const link = document.createElement("a");
    link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    link.textContent = `${source.title}を確認`;
    section.appendChild(link);
  }
  if (evidence.correction) {
    const correction = document.createElement("p");
    correction.textContent = evidence.correction;
    section.appendChild(correction);
  }
  return section;
}

const CARD_HIDDEN_NEN_TAG_IDS = new Set(["nen-user", "nen-unknown", "nen-unavailable_confirmed", "nen-not_awakened_confirmed"]);

// 長い記述を、話数の区切りで箇条書きにする（データは変えない）。
function makeReadableBlock(text) {
  const segments = CharacterFacts.readableSegments(text);
  if (segments.length <= 1) {
    const paragraph = document.createElement("p");
    paragraph.textContent = segments[0] ?? String(text ?? "");
    return paragraph;
  }
  const list = document.createElement("ul");
  list.className = "readable-list";
  segments.forEach((segment) => {
    const item = document.createElement("li");
    item.textContent = segment;
    list.appendChild(item);
  });
  return list;
}

// 人物の詳細の中だけで使う「後の話の情報」の折りたたみ。全画面のネタバレ設定は変えない。
function makeLaterInfoDetails() {
  const later = document.createElement("details");
  later.className = "person-later-info";
  later.open = spoilersRevealed;
  const summary = document.createElement("summary");
  summary.textContent = "後の話の情報を表示";
  later.appendChild(summary);
  later.addEventListener("toggle", () => {
    summary.textContent = later.open ? "後の話の情報を閉じる" : "後の話の情報を表示";
  });
  return later;
}

// 最後の所在。「第○話」の部分は根拠の出来事の詳細を開くボタンにする。
// ネタバレ非表示のときはリンクにしない（後の話の出来事を開かない）。設定を切り替えたら作り直す。
function makeLocationPartNodes(parts) {
  const fragment = document.createDocumentFragment();
  (parts || []).forEach((part) => {
    const event = part.eventId ? eventsData.find((entry) => entry.id === part.eventId) : null;
    if (!event || !spoilersRevealed) {
      fragment.appendChild(document.createTextNode(part.text));
      return;
    }
    const link = document.createElement("a");
    link.className = "latest-place-event-link";
    const url = new URL(location.href);
    // 人物モーダルのHistory APIで変わったパスを、新しいタブ用のリンクへ持ち込まない。
    url.pathname = siteRootUrl.pathname;
    [...url.searchParams.keys()].filter((key) => /^[ct]_/.test(key) || ["person", "event"].includes(key)).forEach((key) => url.searchParams.delete(key));
    url.hash = "timeline";
    url.searchParams.set("event", event.id);
    link.href = url.href;
    link.textContent = part.text;
    link.title = `根拠の出来事を開く（第${event.chapter}話：${event.title || String(event.description || "").split("。")[0]}）`;
    link.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      showDetailModal(event.id, "event", event);
    });
    fragment.appendChild(link);
  });
  return fragment;
}

function fillLatestLocationContent(container, person) {
  container.replaceChildren();
  const { main, confirmed, candidates } = CharacterFacts.latestLocationParts(person, getPersonnelEvents());
  if (container.dataset.heading) {
    const heading = document.createElement("p");
    heading.className = "latest-place-heading";
    heading.textContent = container.dataset.heading;
    container.appendChild(heading);
  }
  const line = document.createElement("p");
  line.className = "latest-place-main";
  line.appendChild(makeLocationPartNodes(main));
  container.appendChild(line);
  if (confirmed) {
    const confirmedLine = document.createElement("p");
    confirmedLine.className = "latest-place-confirmed";
    confirmedLine.appendChild(makeLocationPartNodes(confirmed));
    container.appendChild(confirmedLine);
  }
  if (candidates.length) {
    const note = document.createElement("p");
    note.className = "latest-place-candidates-label";
    note.textContent = "ほかの関係記録（本人の在室は未確認）";
    const list = document.createElement("ul");
    list.className = "readable-list latest-place-candidates";
    candidates.forEach((group) => {
      const item = document.createElement("li");
      item.appendChild(makeLocationPartNodes([
        { text: `第${group.chapter}話`, eventId: group.eventIds[0], chapter: group.chapter },
        { text: group.text.slice(`第${group.chapter}話`.length) }
      ]));
      list.appendChild(item);
    });
    container.append(note, list);
  }
}

function makeLatestLocationContent(person, heading = "") {
  const container = document.createElement("div");
  container.className = "latest-place-content";
  container.dataset.personId = person.id;
  if (heading) container.dataset.heading = heading;
  fillLatestLocationContent(container, person);
  return container;
}

document.addEventListener("spoiler-visibility-change", () => {
  document.querySelectorAll(".latest-place-content[data-person-id]").forEach((container) => {
    const person = charactersData.find((entry) => entry.id === container.dataset.personId)
      || princesData.find((entry) => entry.id === container.dataset.personId);
    if (person) fillLatestLocationContent(container, person);
  });
});

function getPrinceByCamp(camp) {
  return camp ? princesData.find((prince) => prince.camp === camp) : null;
}

// カード表面の「所属・配置先」1行。例：第1王子ベンジャミン陣営・私設兵
function getCharacterAffiliationText(character) {
  if (character.type === "prince") {
    const motherId = character.public_mother_id
      || charactersData.find((queen) => queen.type === "queen" && (queen.children || []).includes(character.id))?.id;
    // 表面では物語開始時点の母（公的な母）だけを示す。実母の記載は後の話の情報として詳細で扱う。
    return motherId && CHAR_MAP[motherId] ? `母：${formatRoyalName(motherId)}` : null;
  }
  if (character.type === "queen") {
    const childIds = [...new Set([...(character.children || []),
      ...charactersData.filter((candidate) => candidate.public_mother_id === character.id).map((candidate) => candidate.id)])];
    const children = childIds.map((id) => CHAR_MAP[id]).filter(Boolean).sort((a, b) => a.rank - b.rank);
    return children.length ? `子：${children.map((child) => formatRoyalName(child.id)).join("・")}` : null;
  }
  if (character.type === "king") return null;
  let base = null;
  let ownerPrince = null;
  if (character.type === "soldier") {
    const queenRank = getQueenAffiliationRank(character);
    const princeRank = getPrinceAffiliationRank(character);
    const queen = queenRank != null ? charactersData.find((candidate) => candidate.type === "queen" && candidate.rank === queenRank) : null;
    ownerPrince = princeRank != null ? princesData.find((prince) => prince.rank === princeRank) : null;
    if (queen) base = `第${queen.rank}王妃${getDisplayName(queen)}・所属兵`;
    else if (ownerPrince) base = `第${ownerPrince.rank}王子${getDisplayName(ownerPrince)}陣営・${character.soldier_category || "兵士"}`;
  } else if (character.type === "attendant") {
    ownerPrince = getPrinceByCamp(character.affiliation) || getPrinceByCamp(character.camp);
    if (ownerPrince) base = `第${ownerPrince.rank}王子${getDisplayName(ownerPrince)}陣営・従事者`;
  }
  if (!base) base = formatAffiliation(character);
  if (!base || base === "不明") base = null;
  // 配置先は、当初から変わらない場合だけ表面に出す（移動・任務先の変化はネタバレ欄と配置履歴で扱う）。
  const placementPrince = getPrinceByCamp(character.camp);
  const hidesPlacement = character.assignment_history?.length || character.target_history?.length || character.target_status === "過去";
  const placement = !hidesPlacement && placementPrince && placementPrince !== ownerPrince
    ? `第${placementPrince.rank}王子${getDisplayName(placementPrince)}陣営` : null;
  if (base && placement) return `${base}／配置：${placement}`;
  return base || (placement ? `配置：${placement}` : null);
}

function makeCharacterAffiliationLine(character, filterTag = null) {
  const text = getCharacterAffiliationText(character);
  if (!text) return null;
  const line = document.createElement("p");
  line.className = "character-affiliation-line";
  if (filterTag) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-affiliation-filter";
    button.textContent = text;
    button.title = `「${filterTag.label}」の人物を表示`;
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("character-tag-filter", { detail: filterTag.id }));
    });
    line.appendChild(button);
  } else {
    line.textContent = text;
  }
  return line;
}

function createCharacterDirectoryCard(character) {
  const card = document.createElement("article");
  card.className = "directory-character-card";
  card.dataset.characterId = character.id;

  const top = document.createElement("div");
  top.className = "directory-character-top";
  const avatarLabel = character.type === "prince" ? `第${character.rank}` : character.name.slice(0, 2);
  top.appendChild(makeAvatar(avatarLabel, character.nen_type, character.image || null, character.image_crop || null, getAvatarZoom(character)));

  const identity = document.createElement("div");
  identity.className = "directory-character-identity";
  const heading = document.createElement("h3");
  heading.textContent = character.type === "prince"
    ? `第${character.rank}王子${getDisplayName(character)}`
    : character.type === "queen"
      ? `第${character.rank}王妃${getDisplayName(character)}`
      : getDisplayName(character);
  const titleText = heading.textContent;
  heading.replaceChildren(makeCharacterDetailLink(character, titleText));
  const badges = document.createElement("div");
  badges.className = "compact-person-badges";
  if (character.generated_by === "personnel-roster") {
    const unknownBadge = document.createElement("span");
    unknownBadge.className = "personnel-roster-badge";
    unknownBadge.textContent = character.roster_projection ? "個人対応未確定" : "人数枠の仮登録";
    badges.appendChild(unknownBadge);
  }
  if (character.roster_view) {
    const rosterBadge = document.createElement("span");
    rosterBadge.className = "personnel-roster-badge";
    rosterBadge.textContent = character.roster_view.initial ? "初期名簿"
      : character.roster_view.basis === "entry_unverified" ? "初期枠との対応未確認" : "追加確認人員";
    badges.appendChild(rosterBadge);
    const rosterState = document.createElement("p");
    rosterState.className = "personnel-roster-state";
    rosterState.textContent = `${character.roster_view.assignment}／${character.roster_view.status}`;
    if (!spoilersRevealed && getPersonnelPeriod() !== "departure" && getPersonnelPeriod() !== "all") {
      rosterState.textContent = `${character.roster_view.assignment}／状態はネタバレ表示で確認`;
    }
    identity.rosterState = rosterState;
  }
  if (character.author_setting) {
    const sourceBadge = document.createElement("span");
    sourceBadge.className = "author-setting-badge";
    sourceBadge.textContent = character.setting_only ? "作者設定表／本編対応未確認" : "作者設定表で氏名確認";
    sourceBadge.title = character.author_setting.scope;
    badges.appendChild(sourceBadge);
  }
  if (character.type !== "soldier") badges.appendChild(makeCharacterTypeBadge(character.type));
  const allianceLabels = character.type === "prince"
    ? alliancesData.filter((alliance) => alliance.prince_ids.includes(character.id)).map((alliance) => ({
      label: alliance.prince_ids.filter((id) => id !== character.id).map((id) => {
        const partner = princesData.find((prince) => prince.id === id);
        return partner ? `第${partner.rank}王子${getDisplayName(partner)}` : id;
      }).join("・")
    }))
    : [];
  // 念の有無はカード上の「念：…」の1行にまとめ、同じ意味のタグは重ねて出さない（絞り込みの一覧には残す）。
  const visibleTags = getCharacterTags(character).filter((tag) => !(character.assignment_history?.length && tag.category === "護衛") && !["分類", "兵種", "人員区分"].includes(tag.category)
    && !CARD_HIDDEN_NEN_TAG_IDS.has(tag.id)
    && !(tag.category === "兵種" && character.type === "soldier" && character.soldier_category
      && formatAffiliation(character)?.includes(character.soldier_category)));
  const headerAffiliationTags = visibleTags.filter((tag) => tag.category === "所属");
  // 所属の主タグ（第○王子私設兵・第○王妃所属兵・マフィアの一家）は、下の「所属・配置先」の行で表示する。
  const primaryAffiliationTag = headerAffiliationTags.find((tag) => /^(?:affiliation-[pq]\d{2}-|mafia-family-)/.test(tag.id));
  headerAffiliationTags.filter((tag) => tag !== primaryAffiliationTag).forEach((tag) => badges.appendChild(makeCharacterTagButton(
    tag.id === "group-zodiacs" && character.former_affiliations?.includes("十二支ん")
      ? { ...tag, label: "元十二支ん" } : tag
  )));
  const affiliationSupplement = getAffiliationSupplement(character);
  if (affiliationSupplement) {
    const supplement = document.createElement("span");
    supplement.className = "character-affiliation-supplement";
    supplement.textContent = affiliationSupplement;
    badges.appendChild(supplement);
  }
  allianceLabels.forEach((alliance) => {
    const badge = document.createElement("span");
    badge.className = "character-alliance-badge";
    badge.classList.add("spoiler-only");
    badge.textContent = `共闘 → ${alliance.label}`;
    badges.appendChild(badge);
  });
  identity.append(heading, badges);
  if (identity.rosterState) identity.appendChild(identity.rosterState);
  top.appendChild(identity);
  card.appendChild(top);
  const context = document.createElement("div");
  context.className = "character-record-context";
  const affiliationLine = makeCharacterAffiliationLine(character, primaryAffiliationTag);
  if (affiliationLine) context.appendChild(affiliationLine);
  if (character.assignment_history?.length) {
    CharacterFacts.assignmentRows(character, charactersData).forEach((entry, index) => {
      const line = document.createElement("p");
      if (index > 0) line.className = "spoiler-only";
      line.textContent = entry.text;
      context.appendChild(line);
    });
  } else if (character.initial_room) {
    const line = document.createElement("p");
    line.textContent = `初期配置：${formatRoomLabel(character.initial_room)}`;
    context.appendChild(line);
  }
  const nen = document.createElement("p");
  nen.className = "nen-knowledge-label";
  if (["unavailable_confirmed", "not_awakened_confirmed"].includes(character.nen_status)) nen.classList.add("spoiler-only");
  nen.textContent = getNenKnowledgeLabel(character, true);
  nen.title = getNenKnowledgeLabel(character);
  context.appendChild(nen);
  const searchQuery = document.getElementById("characterSearch").value.trim();
  if (searchQuery && CharacterFacts.searchRank(character, searchQuery) > 0) {
    const reason = document.createElement("p");
    reason.className = "character-match-reason";
    reason.textContent = CharacterFacts.searchRank(character, searchQuery) === 1 ? "名前の部分一致" : "説明・所属などに一致（本人名の一致ではありません）";
    context.appendChild(reason);
  }
  card.appendChild(context);

  const registrationNotice = CharacterFacts.registrationNotice(character);
  if (registrationNotice) {
    const notice = document.createElement("p");
    notice.className = "guide-source-note";
    notice.textContent = registrationNotice;
    card.appendChild(notice);
  }

  if (visibleTags.some((tag) => tag.category !== "所属")) {
    const tagList = document.createElement("div");
    tagList.className = "character-structured-tags";
    tagList.setAttribute("aria-label", "人物タグ");
    const spoilerTagList = document.createElement("div");
    spoilerTagList.className = "character-structured-tags";
    spoilerTagList.setAttribute("aria-label", "ネタバレタグ");
    const used = new Set(headerAffiliationTags.map((tag) => tag.id));
    const mission = visibleTags.find((tag) => tag.category === "任務" && ["監視", "呪殺", "護衛", "従事", "暗殺"].includes(tag.label));
    const missionTarget = mission && visibleTags.find((tag) => mission.label === "護衛"
      ? tag.category === "護衛"
      : tag.id === getPrinceTargetTagId(character.target));
    if (missionTarget) {
      const historicalTargets = mission.label === "護衛" ? [] : (character.target_history || [])
        .map((entry) => visibleTags.find((tag) => tag.id === getPrinceTargetTagId(entry.target)))
        .filter(Boolean);
      const missionChain = makeCharacterTagChain([mission, ...historicalTargets, missionTarget]);
      if (historicalTargets.length || character.target_status === "過去") {
        tagList.appendChild(makeCharacterTagButton(mission));
        spoilerTagList.appendChild(makeCharacterTagChain([...historicalTargets, missionTarget]));
      } else {
        tagList.appendChild(missionChain);
      }
      if (character.target_status === "過去" && mission.label !== "護衛") {
        const context = document.createElement("span");
        context.className = "character-tag-context";
        context.textContent = "当時";
        spoilerTagList.appendChild(context);
      }
      used.add(mission.id);
      used.add(missionTarget.id);
      historicalTargets.forEach((tag) => used.add(tag.id));
    }
    const blood = visibleTags.find((tag) => tag.id === "relation-blood");
    const bloodRelations = getBloodRelations(character);
    if (blood && bloodRelations.length) {
      spoilerTagList.appendChild(makeBloodRelationChain(blood, bloodRelations, character));
    }
    visibleTags.filter((tag) => tag.category === "血縁").forEach((tag) => used.add(tag.id));
    const possession = visibleTags.find((tag) => tag.id === "duty-possession");
    const possessionTargets = visibleTags.filter((tag) => tag.id.startsWith("possession-target-"));
    if (possession && possessionTargets.length) {
      spoilerTagList.appendChild(makeCharacterTagChain([possession, ...possessionTargets], true));
      used.add(possession.id);
      possessionTargets.forEach((tag) => used.add(tag.id));
    }
    const killTag = visibleTags.find((tag) => tag.id === "status-killer");
    if (killTag) {
      const victims = confirmedKillsById.get(character.id) || [];
      spoilerTagList.appendChild(makeKillTagChain(killTag, victims));
      used.add(killTag.id);
    }
    const deathTag = visibleTags.find((tag) => tag.id === "status-deceased");
    if (deathTag) {
      const deathRow = document.createElement("div");
      deathRow.className = "character-death-tag-row";
      deathRow.appendChild(makeDeathTagChain(deathTag,
        (character.status_log || []).filter((record) => /^死亡/.test(record.status || ""))));
      spoilerTagList.appendChild(deathRow);
      used.add(deathTag.id);
    }
    visibleTags.filter((tag) => !used.has(tag.id)).forEach((tag) => {
      const destination = ["血縁", "状態", "念講習会"].includes(tag.category) ? spoilerTagList : tagList;
      destination.appendChild(makeCharacterTagButton(tag));
    });
    if (tagList.childNodes.length) card.appendChild(tagList);
    if (spoilerTagList.childNodes.length) {
      const spoilerDetails = document.createElement("details");
      spoilerDetails.className = "character-spoiler-details";
      spoilerDetails.open = spoilersRevealed;
      const spoilerSummary = document.createElement("summary");
      spoilerSummary.textContent = spoilersRevealed ? "ネタバレ−" : "ネタバレ＋";
      spoilerDetails.append(spoilerSummary, spoilerTagList);
      spoilerDetails.addEventListener("toggle", () => {
        spoilerSummary.textContent = spoilerDetails.open ? "ネタバレ−" : "ネタバレ＋";
      });
      card.appendChild(spoilerDetails);
    }
  }

  const details = document.createElement("details");
  details.className = "compact-person-details directory-character-details";
  const toggle = document.createElement("summary");
  toggle.textContent = memoEditorEnabled() ? "記録・関連イベント・メモ" : "記録・関連イベント";
  details.appendChild(toggle);
  const authorSetting = makeAuthorSettingPanel(character);
  if (authorSetting) details.appendChild(authorSetting);
  // 後の話の情報は、この人物の中だけで折りたたむ。全画面のネタバレ設定は変えない。
  const later = makeLaterInfoDetails();
  details.appendChild(later);
  const latestPlace = document.createElement("div");
  latestPlace.className = "character-latest-place";
  latestPlace.append(makeLatestLocationContent(character, "最後の所在"));
  later.appendChild(latestPlace);
  later.appendChild(makeCharacterReviewPanel(character));

  const descriptionParagraphs = getCharacterDescriptionParagraphs(character);
  const revealedText = formatDisplayText(character.spoiler_notes);
  const noteSection = document.createElement("section");
  noteSection.className = "character-source-notes";
  const noteHeading = document.createElement("h4");
  noteHeading.textContent = "備考";
  noteSection.appendChild(noteHeading);
  descriptionParagraphs.forEach((text) => noteSection.appendChild(makeReadableBlock(text)));
  if (revealedText) {
    const revealedHeading = document.createElement("h5");
    revealedHeading.textContent = "判明情報";
    noteSection.append(revealedHeading, makeReadableBlock(revealedText));
  }
  later.appendChild(noteSection);

  const sourceExcerpts = makeSourceExcerptGallery(character);
  if (sourceExcerpts) later.appendChild(sourceExcerpts);

  const personTimeline = document.createElement("section");
  personTimeline.className = "directory-person-timeline";
  personTimeline.setAttribute("aria-label", `${getDisplayName(character)}のタイムライン`);

  details.addEventListener("toggle", () => {
    card.classList.toggle("directory-character-expanded", details.open);
    if (details.open && !personTimeline.dataset.rendered) {
      renderCharacterTimeline(character, personTimeline);
      personTimeline.dataset.rendered = "true";
    }
  });

  const beastSection = makeCharacterBeastSection(character);
  if (beastSection) later.appendChild(beastSection);
  const statusHistory = makeCharacterStatusHistory(character);
  if (statusHistory) later.appendChild(statusHistory);

  if (isConfirmedNenUser(character)) {
    const abilitySection = document.createElement("section");
    abilitySection.className = "directory-nen-ability";
    if (character.nen_ability_image) {
      const abilityImage = makeBeastImage(character.nen_ability_image, `${getDisplayName(character)}の念能力の画像`);
      if (abilityImage) {
        if (character.nen_ability_image_source) abilityImage.title = character.nen_ability_image_source;
        abilitySection.appendChild(abilityImage);
      }
    } else {
      const missingImage = document.createElement("span");
      missingImage.className = "ability-image-missing";
      missingImage.textContent = "画像未登録";
      abilitySection.appendChild(missingImage);
    }
    const abilityText = document.createElement("div");
    const abilityHeading = document.createElement("h4");
    abilityHeading.textContent = `念能力：${getNenAbilityName(character)}`;
    const type = document.createElement("p");
    type.textContent = `本人の念系統：${CharacterFacts.nenTypeLabel(character)}`;
    abilityText.append(abilityHeading, type, makeReadableBlock(formatDisplayText(character.nen_ability) || "能力の詳細は未判明。"));
    if (character.nen_ability_image && character.nen_ability_image_source) {
      const caption = document.createElement("p");
      caption.className = "guide-source-note";
      caption.textContent = character.nen_ability_image_source;
      abilityText.appendChild(caption);
    }
    abilitySection.appendChild(abilityText);
    later.appendChild(abilitySection);
    const abilityEditorial = getNenAbilityEditorialLines(character);
    if (abilityEditorial.length) abilityText.appendChild(makeEditorialStatusDetails(abilityEditorial));
  } else if (getNenAbilityEditorialLines(character).length) {
    later.appendChild(makeEditorialStatusDetails(getNenAbilityEditorialLines(character)));
  }

  later.appendChild(personTimeline);

  const editCategory = character.type === "prince" ? "prince" : "bodyguard";
  details.dataset.localRecordKey = localRecordKey(character, editCategory);
  renderLocalEditor(details, character, editCategory, "inline");
  card.appendChild(details);
  return card;
}

function getCharacterTypeGroup(character) {
  if (["king", "queen", "prince"].includes(character.type)) return "royal";
  return character.type;
}

function sortCharacters(a, b) {
  const order = { king: 0, queen: 1, prince: 2, hunter: 3, soldier: 4, attendant: 5, mercenary: 5.5, expedition_member: 5.6, official: 6, mafia: 7, phantom_troupe: 8 };
  const typeDiff = (order[a.type] ?? 99) - (order[b.type] ?? 99);
  if (typeDiff !== 0) return typeDiff;
  if (a.type === "hunter" && b.type === "hunter") {
    const guardRank = (character) => character.mission === "護衛"
      ? princesData.find((prince) => prince.camp === character.camp)?.rank ?? 99
      : 99;
    const rankDiff = guardRank(a) - guardRank(b);
    if (rankDiff !== 0) return rankDiff;
  }
  if (a.type === "soldier" && b.type === "soldier") {
    const affiliationOrder = (character) => {
      const queenRank = getQueenAffiliationRank(character);
      if (queenRank != null || character.soldier_category === "王妃所属兵" || /王妃/.test(character.affiliation || "")) {
        return [1, queenRank ?? 99];
      }
      const princeRank = getPrinceAffiliationRank(character);
      if (princeRank != null) return [0, princeRank];
      const assignedPrince = princesData.find((prince) => prince.camp === character.camp);
      return assignedPrince ? [0, assignedPrince.rank] : [2, 99];
    };
    const [aGroup, aRank] = affiliationOrder(a);
    const [bGroup, bRank] = affiliationOrder(b);
    if (aGroup !== bGroup) return aGroup - bGroup;
    if (aRank !== bRank) return aRank - bRank;
    const soldierPriority = (character) => {
      const categoryOrder = { "私設兵": 0, "王室警備兵": 10, "王妃所属兵": 20 };
      return categoryOrder[character.soldier_category] ?? 30;
    };
    const priorityDiff = soldierPriority(a) - soldierPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    const targetRank = (character) => ["監視", "呪殺", "暗殺"].includes(character.mission)
      ? Number(String(character.target || "").match(/^第(1[0-4]|[1-9])王子/)?.[1] || 99)
      : 99;
    const targetDiff = targetRank(a) - targetRank(b);
    if (targetDiff !== 0) return targetDiff;
  }
  if (a.type === "attendant" && b.type === "attendant") {
    const targetRank = (character) => Number(String(character.target || "").match(/^第(1[0-4]|[1-9])王子/)?.[1] || 99);
    const rankDiff = targetRank(a) - targetRank(b);
    if (rankDiff !== 0) return rankDiff;
  }
  if (a.type === "mafia" && b.type === "mafia") {
    const featured = ["EII-001", "SWU-001", "SWU-002", "SAA-001", "EII-009"];
    const featuredRank = (character) => {
      const index = featured.indexOf(character.id);
      return index < 0 ? 99 : index;
    };
    const featuredDiff = featuredRank(a) - featuredRank(b);
    if (featuredDiff !== 0) return featuredDiff;
    const familyRank = (character) => {
      const family = character.affiliation || "";
      if (family.startsWith("シュウ＝ウ一家")) return 0;
      if (family.startsWith("エイ＝イ一家")) return 1;
      if (family.startsWith("シャ＝ア一家")) return 2;
      return 3;
    };
    const familyDiff = familyRank(a) - familyRank(b);
    if (familyDiff !== 0) return familyDiff;
    const roleRank = (character) => {
      const role = character.role || "";
      if (/副組長/.test(role)) return 0;
      if (/若頭/.test(role)) return 1;
      if (/組長補佐/.test(role)) return 2;
      if (/舎弟頭/.test(role)) return 3;
      if (/幹部/.test(role)) return 4;
      return 5;
    };
    const roleDiff = roleRank(a) - roleRank(b);
    if (roleDiff !== 0) return roleDiff;
    return a.id.localeCompare(b.id, "ja");
  }
  if (a.rank != null || b.rank != null) return (a.rank ?? 999) - (b.rank ?? 999);
  return a.name.localeCompare(b.name, "ja");
}

function renderCharacterDirectory(characters) {
  const container = document.getElementById("characterDirectory");
  const summary = document.getElementById("characterResultSummary");
  container.innerHTML = "";
  const query = document.getElementById("characterSearch")?.value || "";
  currentCharacterResults = characters.slice().sort((a, b) => CharacterFacts.searchRank(a, query) - CharacterFacts.searchRank(b, query) || sortCharacters(a, b));
  currentCharacterResults.forEach((character) => {
    container.appendChild(createCharacterDirectoryCard(character));
  });
  renderCharacterAssignmentTable(currentCharacterResults);
  summary.textContent = characters.length === 0 ? "条件に一致する人物はいません。" : "選択中の人物を表示しています。";
}

function renderCharacterAssignmentTable(characters) {
  const container = document.getElementById("characterAssignmentTable");
  container.innerHTML = "";
  const assignmentOnly = document.getElementById("assignmentOnly")?.checked;
  const rows = assignmentOnly
    ? characters.filter((character) => ["soldier", "hunter", "attendant"].includes(character.type))
    : characters;
  const table = document.createElement("table");
  const head = document.createElement("thead");
  head.innerHTML = "<tr><th>人物</th><th>役割区分</th><th>所属</th><th>配置・護衛先</th><th>任務</th><th>最後の所在</th></tr>";
  const body = document.createElement("tbody");
  rows.forEach((character) => {
    const hidesMovement = !spoilersRevealed && Boolean(character.target_history?.length || character.assignment_history?.length);
    const roleCategory = [
      character.soldier_category,
      character.type === "hunter" ? "ハンター" : null,
      character.type === "attendant" ? "従事者" : null,
      character.mission
    ].filter(Boolean).join("・") || "—";
    const row = document.createElement("tr");
    [
      character.type === "prince" ? `第${character.rank}王子${getDisplayName(character)}` : getDisplayName(character),
      roleCategory,
      formatAffiliation(character) || "—",
      hidesMovement ? "ネタバレ＋で表示（カード）" : CharacterFacts.assignmentRows(character, charactersData).at(-1)?.text || formatAssignment(character) || "—",
      hidesMovement ? formatDisplayText(character.mission) || "—"
        : [formatDisplayText(character.mission), formatDisplayText(character.target)].filter(Boolean).join("：") || "—",
      hidesMovement ? "ネタバレ＋で表示（カード）"
        : CharacterFacts.latestLocationLabel(character, getPersonnelEvents())
    ].forEach((value, columnIndex) => {
      const cell = document.createElement("td");
      if (columnIndex === 0) cell.appendChild(makeCharacterDetailLink(character, value));
      else cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.append(head, body);
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty-state";
    empty.textContent = "このグループには配置表の対象人物がいません。「配置に関係する人物のみ」を外すと全員を表示できます。";
    container.appendChild(empty);
  }
  container.appendChild(table);
}

function setCharacterView(view) {
  activeCharacterView = view;
  const cards = document.getElementById("characterDirectory");
  const table = document.getElementById("characterAssignmentTable");
  cards.hidden = view !== "cards";
  table.hidden = view !== "table";
  document.querySelector(".assignment-only-toggle").hidden = view !== "table";
  [["characterViewCards", "cards"], ["characterViewTable", "table"]].forEach(([id, value]) => {
    const button = document.getElementById(id);
    const active = value === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setSpoilersRevealed(revealed, persist = true) {
  spoilersRevealed = revealed;
  document.body.classList.toggle("spoilers-revealed", revealed);
  const button = document.getElementById("characterSpoilerToggle");
  button.textContent = revealed ? "ネタバレを隠す" : "ネタバレ解除";
  button.setAttribute("aria-pressed", String(revealed));
  document.getElementById("characterSpoilerHelp").textContent = revealed
    ? "血縁・任務先の変化・死亡などの後の話の情報を表示中です。"
    : "後の話の情報は隠しています。人物ごとに「後の話の情報を表示」で開けます（全体の設定は変わりません）。";
  document.querySelectorAll(".character-spoiler-details").forEach((details) => {
    details.open = revealed;
    details.querySelector("summary").textContent = revealed ? "ネタバレ−" : "ネタバレ＋";
  });
  document.getElementById("characterSpoilerTagGroups").open = revealed;
  document.querySelectorAll(".person-later-info").forEach((later) => { later.open = revealed; });
  renderCharacterAssignmentTable(currentCharacterResults);
  refreshSharedSpoilers();
  document.dispatchEvent(new CustomEvent("spoiler-visibility-change", { detail: { revealed } }));
  if (!revealed) {
    document.querySelectorAll(".directory-character-details").forEach((details) => { details.open = false; });
    document.getElementById("detailModal")?.classList.add("hidden");
  }
  if (persist) {
    try {
      localStorage.setItem(SPOILER_VISIBILITY_KEY, revealed ? "true" : "false");
    } catch (error) {
      console.warn("ネタバレ表示設定を保存できませんでした", error);
    }
  }
}

function getCatalogTagRow(tag) {
  if (tag.id.startsWith("affiliation-p") && tag.id.endsWith("-private")) return "私設兵";
  if (tag.id.startsWith("affiliation-q") || tag.id === "affiliation-royal-guards") return "所属兵";
  if (tag.id.startsWith("mafia-family-")) return "マフィア";
  if (["group-kurapika-team", "hunter-beyond-kyousen", "qualification-provisional-associate", "group-zodiacs"].includes(tag.id)) return "ハンター";
  if (tag.category === "所属") return "その他所属";
  if (tag.category === "血縁") {
    return tag.id === "family-q01-child" || tag.id.startsWith("blood-parent-") ? "血縁" : null;
  }
  return ["初期配置", "念", "状態", "念講習会"].includes(tag.category) ? tag.category : null;
}

function getCharacterFilterFacet(tag) {
  return getCatalogTagRow(tag) || tag.category;
}

function toggleCharacterTagFilter(tagId) {
  const tag = characterTagDefinitions.get(tagId);
  if (!tag) return;
  const facet = getCharacterFilterFacet(tag);
  if (activeCharacterTags.get(facet) === tagId) activeCharacterTags.delete(facet);
  else activeCharacterTags.set(facet, tagId);
}

function matchesCharacterTagFilters(character) {
  const tags = new Set(getCharacterTags(character).map((tag) => tag.id));
  return [...activeCharacterTags.values()].every((tagId) => tags.has(tagId));
}

// 人物一覧の検索対象。ネタバレ非表示の時は名前・別名・所属・初期配置・分類だけにし、
// 状態・念能力・備考・出来事・後の配置先などの後の話の情報では一致させない（CharacterFacts.searchFields）。
function getCharacterSearchFields(character, revealed = spoilersRevealed) {
  const initialRoom = formatRoomLabel(character.initial_room);
  const initial = [formatAffiliation(character), initialRoom, CHARACTER_TYPE_LABELS[character.type]];
  if (!revealed) return CharacterFacts.searchFields(character, { revealed: false, extra: { initial } });
  const beast = character.type === "prince"
    ? spiritBeastsData.find((candidate) => candidate.prince.replace(/＝ホイコーロ/g, "") === getDisplayName(character))
    : null;
  const later = [formatAssignment(character), getNenClassLabel(character), formatRoomLabel(character.room), beast?.name, beast?.ability];
  return CharacterFacts.searchFields(character, { revealed: true, extra: { initial, later } });
}

function getCharacterSearchText(character, revealed = spoilersRevealed) {
  return CharacterFacts.buildSearchText(getCharacterSearchFields(character, revealed));
}

function setupCharacterDirectory() {
  const search = document.getElementById("characterSearch");
  const typeFilter = document.getElementById("characterTypeFilter");
  const campFilter = document.getElementById("characterCampFilter");
  const princeFilter = document.getElementById("characterPrinceFilter");
  const activeTagBar = document.getElementById("characterActiveTag");
  const periodFilter = document.getElementById("characterPeriodFilter");
  const queenFilter = document.getElementById("characterQueenFilter");
  const onboardCharacters = charactersData.filter(isDirectoryCharacter);
  const chapterOptions = document.createElement("optgroup");
  chapterOptions.label = "話数を指定（確認できた履歴まで）";
  [...new Set(eventsData.map(event => event.chapter))].sort((a,b) => a-b).forEach(chapter => {
    if (chapter < 359 || chapter === 374) return;
    const option = document.createElement("option"); option.value = `chapter-${chapter}`;
    option.textContent = `第${chapter}話時点`; chapterOptions.appendChild(option);
  });
  periodFilter.appendChild(chapterOptions);
  const queenNav = document.getElementById("personnelQueenNav");
  for (let rank = 1; rank <= 7; rank++) {
    const button = document.createElement("button"); button.type = "button";
    button.className = "character-camp-nav-button"; button.dataset.queenRank = String(rank);
    button.textContent = `第${rank}王妃所属兵`;
    button.addEventListener("click", () => {
      if (activeCharacterSection !== "personnel" && periodFilter.value === "all") periodFilter.value = "departure";
      queenFilter.value = queenFilter.value === String(rank) ? "all" : String(rank); activeCharacterSection = "personnel"; apply();
    });
    queenNav.appendChild(button);
  }
  [...new Set(onboardCharacters.map((character) => character.camp).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja")).forEach((camp) => {
      const option = document.createElement("option");
      option.value = camp;
      option.textContent = `${formatDisplayText(camp).replace(/陣営$/, "")}への配置`;
      campFilter.appendChild(option);
    });
  princesData.slice().sort((a, b) => a.rank - b.rank).forEach((prince) => {
    const option = document.createElement("option");
    option.value = prince.id;
    option.textContent = `第${prince.rank}王子${getDisplayName(prince)}`;
    princeFilter.appendChild(option);
  });

  const quickNav = document.getElementById("characterCampNav");
  const missionNav = document.getElementById("characterMissionNav");
  const missionRow = document.getElementById("characterMissionRow");
  const princeNav = document.getElementById("characterPrinceNav");
  const princeRow = document.getElementById("characterPrinceRow");
  const extraTagGroups = document.getElementById("characterExtraTagGroups");
  const spoilerTagGroups = document.getElementById("characterSpoilerTagGroups");
  const spoilerTagRows = document.getElementById("characterSpoilerTagRows");
  const topGroups = [
    { id: "princes", label: "14王子" },
    { id: "queens", label: "王妃" },
    { id: "major", label: "主要人物" },
    { id: "royal", label: "王族" },
    { id: "hunter", label: "ハンター" },
    { id: "personnel", label: "兵士・従事者" },
    { id: "soldier", label: "兵士" },
    { id: "attendant", label: "従事者" },
    { id: "mercenary", label: "傭兵" },
    { id: "expedition_member", label: "探検隊関係者" },
    { id: "mafia", label: "マフィア" },
    { id: "phantom_troupe", label: "幻影旅団" },
    { id: "official", label: "司法・政府" },
    { id: "all", label: "全員" }
  ];
  const addCatalogTag = (container, tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-catalog-tag character-facet-${getCharacterTagColorClass(tag)}`;
    button.textContent = getCharacterTagShortLabel(tag);
    button.dataset.tagId = tag.id;
    button.title = `「${getCharacterFilterFacet(tag)}：${tag.label}」を条件に追加・解除`;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("character-tag-filter", { detail: tag.id }));
    });
    container.appendChild(button);
  };
  const missionOrder = ["監視", "潜入", "暗殺", "呪殺", "憑依", "従事", "護衛", "調整", "司法", "捜査"];
  [...characterTagDefinitions.values()]
    .filter((tag) => tag.category === "任務" && onboardCharacters.some((character) => getCharacterTags(character).some((personTag) => personTag.id === tag.id)))
    .sort((a, b) => {
      const aIndex = missionOrder.indexOf(a.label);
      const bIndex = missionOrder.indexOf(b.label);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.label.localeCompare(b.label, "ja");
    })
    .forEach((tag) => addCatalogTag(missionNav, tag));
  const princeAllButton = document.createElement("button");
  princeAllButton.type = "button";
  princeAllButton.className = "character-catalog-tag character-facet-relation";
  princeAllButton.textContent = "すべて";
  princeAllButton.dataset.princeId = "all";
  princeNav.appendChild(princeAllButton);
  princesData.slice().sort((a, b) => a.rank - b.rank).forEach((prince) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-catalog-tag character-facet-relation";
    button.textContent = `第${prince.rank}王子`;
    button.title = `第${prince.rank}王子${getDisplayName(prince)}に関係する人物を表示`;
    button.dataset.princeId = prince.id;
    princeNav.appendChild(button);
  });
  princeNav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-prince-id]");
    if (!button) return;
    princeFilter.value = princeFilter.value === button.dataset.princeId ? "all" : button.dataset.princeId;
    apply();
  });
  const catalogRows = ["私設兵", "所属兵", "マフィア", "ハンター", "その他所属", "初期配置", "念", "血縁", "状態", "念講習会"];
  catalogRows.forEach((category) => {
    const tags = [...characterTagDefinitions.values()].filter((tag) => getCatalogTagRow(tag) === category
      && onboardCharacters.some((character) => getCharacterTags(character).some((personTag) => personTag.id === tag.id)));
    if (!tags.length) return;
    tags.sort((a, b) => {
      const rank = (tag) => Number(tag.label.match(/^第(\d+)王(?:子|妃)/)?.[1] || 99);
      return rank(a) - rank(b);
    });
    const row = document.createElement("div");
    row.className = "character-tag-row character-tag-row-extra";
    row.dataset.tagCategory = category;
    const label = document.createElement("span");
    label.className = "character-tag-row-label";
    label.textContent = category;
    const options = document.createElement("div");
    options.className = "character-tag-row-options";
    tags.forEach((tag) => addCatalogTag(options, tag));
    row.append(label, options);
    if (category === "初期配置") {
      row.title = "当初の担当居室（後任・仮称人物は最初の確認配置）。転属・応援・面会後の現在地や出航時の在室者一覧ではありません。初期担当を確認できない人物には付けません。";
    }
    (["血縁", "状態", "念講習会"].includes(category) ? spoilerTagRows : extraTagGroups).appendChild(row);
  });
  const inActiveSection = (character) => {
    if (activeCharacterSection === "all") return true;
    if (activeCharacterSection === "personnel") return Boolean(character.roster_view)
      || personnelRosterData.members.some(m => m.character_id === character.id)
      || personnelRosterData.later.some(m => m.character_id === character.id);
    if (activeCharacterSection === "princes") return character.type === "prince";
    if (activeCharacterSection === "queens") return character.type === "queen";
    if (activeCharacterSection === "major") return isMajorCharacter(character);
    return getCharacterTypeGroup(character) === activeCharacterSection;
  };
  const renderContextualTags = () => {
    const members = onboardCharacters.filter(inActiveSection);
    const availableTags = new Set(members.flatMap((character) => getCharacterTags(character).map((tag) => tag.id)));
    // カテゴリ外でも選択中の条件は残す。0件を避けるために勝手に条件を外さない。
    activeCharacterTags.forEach((tagId) => availableTags.add(tagId));
    missionNav.querySelectorAll("button[data-tag-id]").forEach((button) => {
      button.hidden = !availableTags.has(button.dataset.tagId);
    });
    missionRow.hidden = !missionNav.querySelector("button[data-tag-id]:not([hidden])");
    princeRow.hidden = false;
    document.querySelectorAll("#characterExtraTagGroups .character-tag-row-extra, #characterSpoilerTagRows .character-tag-row-extra").forEach((row) => {
      row.querySelectorAll("button[data-tag-id]").forEach((button) => {
        button.hidden = !availableTags.has(button.dataset.tagId);
      });
      row.hidden = !row.querySelector("button[data-tag-id]:not([hidden])");
    });
    spoilerTagGroups.hidden = !spoilerTagRows.querySelector(".character-tag-row-extra:not([hidden])");
  };
  const findMatchingCharacters = () => {
    const query = search.value.trim();
    const type = typeFilter.value;
    const camp = campFilter.value;
    const princeId = princeFilter.value;
    const rosterMode = activeCharacterSection === "personnel" || queenFilter.value !== "all" || periodFilter.value !== "all";
    const universe = rosterMode ? getPersonnelSelection(queenFilter.value === "all" ? null : Number(queenFilter.value)) : onboardCharacters;
    return universe.filter((character) => {
      const sectionMatch = inActiveSection(character);
      const typeMatch = type === "all" || getCharacterTypeGroup(character) === type;
      const campMatch = camp === "all" || character.camp === camp;
      const tagMatch = matchesCharacterTagFilters(character);
      const affiliationMatch = !activeCharacterAffiliation
        || character.affiliation === activeCharacterAffiliation
        || character.affiliation?.startsWith(`${activeCharacterAffiliation}（`);
      const princeMatch = princeId === "all" || getRelatedPrinceIds(character).includes(princeId)
        || character.roster_member?.prince_ranks.includes(Number(princeId.slice(1)));
      return sectionMatch && typeMatch && campMatch && tagMatch && affiliationMatch && princeMatch
        && (!query || CharacterFacts.matchesSearch(getCharacterSearchText(character), query));
    }).sort((a, b) => CharacterFacts.searchRank(a, query) - CharacterFacts.searchRank(b, query));
  };
  const apply = () => {
    const filtered = findMatchingCharacters();
    renderCharacterDirectory(filtered);
    document.getElementById("characterResultSummary").textContent = filtered.length
      ? `現在の条件に一致：${filtered.length}人。${filtered.some(person => person.setting_only) ? `うち${filtered.filter(person => person.setting_only).length}人は作者設定表のみで確認（本編対応未照合・兵力への加算なし）。` : ""}`
      : "条件に一致する人物はいません。選択中の条件を外すか「すべて解除」を押してください。";
    const rosterMode = activeCharacterSection === "personnel" || queenFilter.value !== "all" || periodFilter.value !== "all";
    const ledger = rosterMode ? getPersonnelSelection(queenFilter.value === "all" ? null : Number(queenFilter.value)) : [];
    const {withoutStop, unknown} = PersonnelRoster.counts(ledger);
    let rosterText = rosterMode ? (spoilersRevealed || periodFilter.value === "departure"
      ? (periodFilter.value === "departure"
        ? `名簿全体（選択時点・王妃）：${ledger.length}枠。初期復元を含み、全員の初期在籍を個別確認済みという意味ではありません。`
        : `名簿全体（選択時点・王妃）：${ledger.length}人／死亡・拘束・辞退・離脱の履歴なし：${withoutStop}人（うち状態未確認${unknown}人）。稼働確認済み人数ではありません。`)
      : `名簿全体（選択時点・王妃）：${ledger.length}人。状態別の人数はネタバレ表示で確認できます。`) : "";
    if (rosterMode) rosterText += ' 検索語・その他の絞り込みを適用する前の集計です。';
    if (spoilersRevealed && queenFilter.value !== "all" && periodFilter.value === "chapter-374") {
      const queen = Number(queenFilter.value);
      const diagram = PersonnelRoster.diagramCount(personnelSnapshotsData.find(item => item.chapter === 374), queen);
      const initial = PersonnelRoster.select(personnelRosterData, charactersData, {period: "departure", queen}).length;
      rosterText += ` 初期復元：${initial}人／第374話の原図記載：${diagram}人。原図の集計範囲・除外条件との対応は未確定で、差は登録漏れを意味しません。`;
    }
    document.getElementById("personnelRosterSummary").textContent = rosterText;
    queenNav.querySelectorAll("button").forEach(button => {
      const rank = Number(button.dataset.queenRank);
      const total = getPersonnelSelection(rank).length;
      button.textContent = `第${rank}王妃所属兵 ${total}人`;
      button.classList.toggle("active", queenFilter.value === String(rank));
      button.setAttribute("aria-pressed", String(queenFilter.value === String(rank)));
    });
    renderContextualTags();
    quickNav.querySelectorAll("button").forEach((button) => {
      const selected = button.dataset.groupId === activeCharacterSection;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll(".character-catalog-tag[data-tag-id]").forEach((button) => {
      const selected = [...activeCharacterTags.values()].includes(button.dataset.tagId);
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    princeNav.querySelectorAll("button").forEach((button) => {
      const selected = button.dataset.princeId === princeFilter.value;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    // 関係王子の行は既定で閉じる。選択中は開いて、見出しに選択中の王子を出す（手で開いたものは閉じない）。
    const princeDetails = document.getElementById("characterPrinceDetails");
    const selectedPrince = princesData.find((candidate) => candidate.id === princeFilter.value);
    if (princeDetails && selectedPrince) princeDetails.open = true;
    const princeSummary = document.getElementById("characterPrinceSummary");
    if (princeSummary) princeSummary.textContent = selectedPrince ? `選択中：第${selectedPrince.rank}王子` : "第1〜第14王子から選ぶ";
    activeTagBar.replaceChildren();
    const addActiveFilter = (label, clearFilter) => {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = `${label} ×`;
      clear.title = `${label}の条件を解除`;
      clear.setAttribute("aria-label", `${label}を解除`);
      clear.addEventListener("click", () => {
        clearFilter();
        apply();
      });
      activeTagBar.appendChild(clear);
    };
    if (activeCharacterSection !== "all") {
      addActiveFilter(`カテゴリ：${topGroups.find((group) => group.id === activeCharacterSection)?.label || activeCharacterSection}`, () => { activeCharacterSection = "all"; });
    }
    if (princeFilter.value !== "all") {
      const prince = princesData.find((candidate) => candidate.id === princeFilter.value);
      addActiveFilter(`関係王子：第${prince.rank}王子`, () => { princeFilter.value = "all"; });
    }
    activeCharacterTags.forEach((tagId, facet) => {
      const tag = characterTagDefinitions.get(tagId);
      addActiveFilter(`${facet}：${getCharacterTagShortLabel(tag)}`, () => { activeCharacterTags.delete(facet); });
    });
    if (activeCharacterAffiliation) addActiveFilter(`所属：${formatDisplayText(activeCharacterAffiliation)}`, () => { activeCharacterAffiliation = null; });
    if (typeFilter.value !== "all") addActiveFilter(`分類：${CHARACTER_TYPE_LABELS[typeFilter.value] || typeFilter.value}`, () => { typeFilter.value = "all"; });
    if (campFilter.value !== "all") addActiveFilter(`配置：${formatDisplayText(campFilter.value)}`, () => { campFilter.value = "all"; });
    if (search.value.trim()) addActiveFilter(`検索：${search.value.trim()}`, () => { search.value = ""; });
    if (periodFilter.value !== "all") addActiveFilter(`時点：${periodFilter.selectedOptions[0].textContent}`, () => {periodFilter.value = "all";});
    if (queenFilter.value !== "all") addActiveFilter(`第${queenFilter.value}王妃所属兵`, () => {queenFilter.value = "all";});
    if (!activeTagBar.childElementCount) {
      const empty = document.createElement("span");
      empty.textContent = "条件なし（全員）";
      activeTagBar.appendChild(empty);
    }
    const noCharacterFilters = activeCharacterSection === "all"
      && princeFilter.value === "all" && !activeCharacterTags.size && !activeCharacterAffiliation
      && typeFilter.value === "all" && campFilter.value === "all" && !search.value.trim()
      && periodFilter.value === "all" && queenFilter.value === "all";
    document.getElementById("clearCharacterFilters").disabled = noCharacterFilters;
    // 条件がないときは「条件なし」の行を出さず、最初の画面で人物カードまで見えるようにする。
    document.querySelector(".character-tag-catalog")?.classList.toggle("has-active-filters", !noCharacterFilters);
    updateViewPermalink();
  };
  document.getElementById("clearCharacterFilters").addEventListener("click", () => {
    search.value = "";
    activeCharacterTags.clear();
    activeCharacterSection = "all";
    activeCharacterSubgroup = null;
    activeCharacterAffiliation = null;
    typeFilter.value = "all";
    campFilter.value = "all";
    princeFilter.value = "all";
    periodFilter.value = "all";
    queenFilter.value = "all";
    apply();
  });
  search.addEventListener("input", apply);
  // ネタバレ設定を切り替えたら、検索対象が変わるので検索中の結果を作り直す。
  document.addEventListener("spoiler-visibility-change", apply);
  typeFilter.addEventListener("change", apply);
  campFilter.addEventListener("change", apply);
  princeFilter.addEventListener("change", apply);
  periodFilter.addEventListener("change", () => { activeCharacterSection = "personnel"; apply(); });
  queenFilter.addEventListener("change", () => {
    if (activeCharacterSection !== "personnel" && periodFilter.value === "all") periodFilter.value = "departure";
    activeCharacterSection = "personnel"; apply();
  });
  document.addEventListener("character-affiliation-filter", apply);
  document.addEventListener("character-tag-filter", (event) => {
    const tagId = typeof event.detail === "string" ? event.detail : event.detail?.id;
    const rosterQueen = tagId?.match(/^affiliation-q0([1-7])-guards$/)?.[1];
    if (rosterQueen) {
      if (activeCharacterSection !== "personnel" && periodFilter.value === "all") periodFilter.value = "departure";
      queenFilter.value = queenFilter.value === rosterQueen ? "all" : rosterQueen;
      activeCharacterSection = "personnel";
      activeCharacterTags.delete("所属兵");
      apply(); return;
    }
    // 人物カードの護衛先・対象も、一覧の統合された「関係王子」へ接続する。
    const relatedPrince = tagId?.match(/^(?:guard|target)-(p\d{2})$/i)?.[1]?.toUpperCase();
    if (relatedPrince) {
      const button = princeNav.querySelector(`button[data-prince-id="${relatedPrince}"]`);
      if (button) button.click();
      return;
    }
    if (!characterTagDefinitions.has(tagId)) return;
    toggleCharacterTagFilter(tagId);
    apply();
  });

  topGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-camp-nav-button${group.id === "all" ? " active" : ""}`;
    button.textContent = group.label;
    button.dataset.groupId = group.id;
    button.setAttribute("aria-pressed", String(group.id === "all"));
    button.addEventListener("click", () => {
      const enteringPersonnel = group.id === "personnel" && activeCharacterSection !== "personnel";
      activeCharacterSection = activeCharacterSection === group.id ? "all" : group.id;
      if (enteringPersonnel && periodFilter.value === "all") periodFilter.value = "departure";
      if (activeCharacterSection !== "personnel") { queenFilter.value = "all"; periodFilter.value = "all"; }
      activeCharacterSubgroup = null;
      apply();
    });
    quickNav.appendChild(button);
  });
  document.getElementById("characterViewCards").addEventListener("click", () => setCharacterView("cards"));
  document.getElementById("characterViewTable").addEventListener("click", () => setCharacterView("table"));
  document.getElementById("characterSpoilerToggle").addEventListener("click", () => {
    setSpoilersRevealed(!spoilersRevealed);
  });
  document.getElementById("assignmentOnly").addEventListener("change", () => renderCharacterAssignmentTable(currentCharacterResults));
  [quickNav, ...document.querySelectorAll("#characterFilterPanel .character-tag-row-options")].forEach((container) => {
    setupRovingToolbar(container, container.closest(".character-tag-row")?.querySelector(".character-tag-row-label")?.textContent || null);
  });
  typeFilter.value = "all";
  renderContextualTags();
  setCharacterView("cards");
  apply();
  setSpoilersRevealed(spoilersRevealed, false);
}

// ===== 派閥マップ =====

const FACTION_COLORS = [
  "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e91e8c", "#ff7675",
  "#fd9644", "#a29bfe", "#00cec9"
];

function renderFactions(factions) {
  const grid = document.getElementById("faction-grid");
  grid.innerHTML = "";
  factions.forEach((f, i) => {
    const card = document.createElement("article");
    card.className = "faction-card";
    const color = FACTION_COLORS[i % FACTION_COLORS.length];
    card.style.borderLeftColor = color;

    const title = document.createElement("h3");
    title.textContent = f.name;
    title.style.color = color;
    card.appendChild(title);

    const leader = document.createElement("span");
    leader.className = "faction-leader";
    leader.textContent = `リーダー: ${formatRoyalName(f.leader) || "なし"}`;
    card.appendChild(leader);

    const membersDiv = document.createElement("div");
    membersDiv.className = "faction-members";
    (f.members || []).forEach((m) => {
      const chip = document.createElement("span");
      chip.className = "faction-member-chip";
      chip.textContent = formatRoyalName(m);
      membersDiv.appendChild(chip);
    });
    card.appendChild(membersDiv);

    const strategy = document.createElement("p");
    strategy.className = "faction-strategy";
    strategy.textContent = f.strategy || "";
    card.appendChild(strategy);

    grid.appendChild(card);
  });
}

// ===== 下層勢力マップ（マフィア） =====

const MAFIA_COLORS = ["#e74c3c", "#9b59b6", "#3498db", "#2c3e50"];

function renderMafia(mafiaList) {
  const grid = document.getElementById("mafia-grid");
  grid.innerHTML = "";
  mafiaList.forEach((org, i) => {
    const card = document.createElement("article");
    card.className = "mafia-card";
    const color = MAFIA_COLORS[i % MAFIA_COLORS.length];
    card.style.borderLeftColor = color;

    const title = document.createElement("h3");
    title.textContent = org.name;
    title.style.color = color;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "mafia-meta";
    [
      `組長: ${org.leader}`,
      `ケツモチ: ${org.ketsu_mochi}`,
      `拠点: ${org.base_layer}`
    ].forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      meta.appendChild(span);
    });
    card.appendChild(meta);

    const membersDiv = document.createElement("div");
    membersDiv.className = "mafia-members";
    (org.members || []).forEach((entry) => {
      const canonical = charactersData.find(p => p.id === entry.character_id);
      const member = canonical ? {...entry, name: canonical.display_name || canonical.name, nen_type: canonical.nen_type, ability: canonical.nen_ability} : entry;
      const row = document.createElement("div");
      row.className = "mafia-member-row";

      const nameWrap = document.createElement("div");
      nameWrap.className = "mafia-member-header";
      const nameSpan = document.createElement("span");
      nameSpan.className = "mafia-member-name";
      nameSpan.textContent = member.name;
      const roleSpan = document.createElement("span");
      roleSpan.className = "mafia-member-role";
      roleSpan.textContent = member.role;
      nameWrap.append(nameSpan, roleSpan);
      if (member.nen_type) nameWrap.appendChild(makeNenBadge(member.nen_type));

      const ability = document.createElement("p");
      ability.className = "mafia-member-ability";
      ability.textContent = member.ability || "能力不明";

      row.append(nameWrap, ability);
      membersDiv.appendChild(row);
    });
    card.appendChild(membersDiv);

    const purpose = document.createElement("p");
    purpose.className = "mafia-purpose";
    purpose.textContent = `目的: ${org.purpose}`;
    card.appendChild(purpose);

    if (org.note) {
      const note = document.createElement("p");
      note.className = "mafia-note";
      note.textContent = org.note;
      card.appendChild(note);
    }

    grid.appendChild(card);
  });
}

// ===== 下層勢力 相関図 =====
// mafia.json本文（purpose/note）から読み取れる関係性を一覧化したもの
const MAFIA_RELATIONS = [
  { a: "シュウ＝ウ一家", b: "エイ＝イ一家", type: "敵対" },
  { a: "シュウ＝ウ一家", b: "シャ＝ア一家", type: "協力" },
  { a: "シュウ＝ウ一家", b: "幻影旅団（スパイダー）", type: "中立（成り行きで共通の敵）" },
  { a: "エイ＝イ一家", b: "シャ＝ア一家", type: "敵対" },
  { a: "エイ＝イ一家", b: "幻影旅団（スパイダー）", type: "敵視される" },
  { a: "シャ＝ア一家", b: "幻影旅団（スパイダー）", type: "中立（成り行きで共通の敵）" }
];

const RELATION_CLASS_MAP = {
  "協力": "ally",
  "敵対": "hostile",
  "敵視される": "hostile",
  "中立（成り行きで共通の敵）": "neutral"
};

function findRelation(nameA, nameB) {
  return MAFIA_RELATIONS.find((r) =>
    (r.a === nameA && r.b === nameB) || (r.a === nameB && r.b === nameA)
  );
}

function renderMafiaRelationMatrix(mafiaList) {
  const container = document.getElementById("mafia-relation-matrix");
  if (!container) return;
  container.innerHTML = "";

  const names = mafiaList.map((m) => m.name);
  const table = document.createElement("table");
  table.className = "relation-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th"));
  names.forEach((n) => {
    const th = document.createElement("th");
    th.textContent = n;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  names.forEach((rowName) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = rowName;
    tr.appendChild(th);
    names.forEach((colName) => {
      const td = document.createElement("td");
      if (rowName === colName) {
        td.className = "relation-self";
        td.textContent = "—";
      } else {
        const rel = findRelation(rowName, colName);
        if (rel) {
          td.className = `relation-${RELATION_CLASS_MAP[rel.type] || "neutral"}`;
          td.textContent = rel.type;
        } else {
          td.className = "relation-unknown";
          td.textContent = "不明";
        }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// ===== タイムライン（events.json） =====

function parseTimeString(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  return null;
}

// 話内の順序を明示できる場合は優先し、既存IDを参照するメモやリンクを保つ。
function sortKey(event) {
  const seq = event.chapter_order ?? (parseInt(String(event.id).split("-")[1], 10) || 0);
  return event.chapter * 1000 + seq;
}

function getDuration(event) {
  const start = parseTimeString(event.time_start);
  const end = parseTimeString(event.time_end);
  if (start != null && end != null && end > start) return end - start;
  return 30;
}

function getChapterLabel(event) {
  return `${event.chapter}話${event.chapter_title ? "：" + event.chapter_title : ""}`;
}

// 出来事の見出し：title があればそれ、なければ本文の最初の一文（『』「」（）の中の「。」では区切らない）。
// 残りの文は詳細（モーダル）の「出来事の全文」で読む。
function getEventHeadline(event) {
  if (event.title) return String(event.title).trim();
  const text = String(event.description || "").trim();
  const closers = { "『": "』", "「": "」", "（": "）", "〝": "〟", "《": "》", "【": "】" };
  const closerSet = new Set(Object.values(closers));
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (closers[ch]) depth += 1;
    else if (closerSet.has(ch)) depth = Math.max(0, depth - 1);
    else if (ch === "。" && depth === 0) return text.slice(0, i + 1);
  }
  return text;
}

function eventHasMoreText(event) {
  const headline = getEventHeadline(event);
  const full = String(event.description || "").trim();
  return Boolean(full) && headline.replace(/。$/, "") !== full.replace(/。$/, "");
}

function getTimeLabel(event) {
  if (!event.time_start) return null;
  return event.time_end ? `${event.time_start}〜${event.time_end}` : event.time_start;
}

function getTimelineTimePlacement(event) {
  const exactMinutes = parseTimeString(event.time_start);
  if (exactMinutes != null) return { minutes: exactMinutes, label: event.time_start, estimated: false };
  return inferredTimePlacements.get(event.id) || null;
}

function buildInferredTimePlacements(events) {
  const placements = new Map();
  const byDay = new Map();
  events.forEach((event) => {
    const explicitEstimate = parseTimeString(event.time_estimate);
    if (parseTimeString(event.time_start) == null && explicitEstimate != null) {
      placements.set(event.id, { minutes: explicitEstimate, label: `${event.time_estimate}頃？`, estimated: true });
    }
    if (event.day == null) return;
    const day = Number(event.day);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(event);
  });

  byDay.forEach((dayEvents) => {
    const ordered = dayEvents.slice().sort((a, b) => sortKey(a) - sortKey(b));
    ordered.forEach((event) => {
      const minutes = parseTimeString(event.time_estimate);
      if (parseTimeString(event.time_start) != null || minutes == null) return;
      placements.set(event.id, { minutes, label: `${event.time_estimate}頃？`, estimated: true });
    });
    const anchors = ordered
      .map((event, index) => ({ index, minutes: parseTimeString(event.time_start) ?? parseTimeString(event.time_estimate) }))
      .filter((anchor) => anchor.minutes != null);
    if (anchors.length === 0) return;

    ordered.forEach((event, index) => {
      if (parseTimeString(event.time_start) != null || placements.has(event.id)) return;
      if (event.time_inference === false) return;
      if (["flashback", "reference", "setting"].includes(getChronologyKind(event))) return;
      const before = anchors.filter((anchor) => anchor.index < index).at(-1);
      const after = anchors.find((anchor) => anchor.index > index);
      let minutes;
      if (before && after && before.minutes <= after.minutes) {
        const progress = (index - before.index) / (after.index - before.index);
        minutes = before.minutes + (after.minutes - before.minutes) * progress;
      } else if (before) {
        minutes = before.minutes + (index - before.index) * 15;
      } else if (after) {
        minutes = after.minutes - (after.index - index) * 15;
      }
      if (minutes == null) return;
      const rounded = Math.max(0, Math.min(1439, Math.round(minutes / 15) * 15));
      const hour = Math.floor(rounded / 60);
      const minute = String(rounded % 60).padStart(2, "0");
      placements.set(event.id, {
        minutes: rounded,
        label: `${String(hour).padStart(2, "0")}:${minute}頃？`,
        estimated: true
      });
    });
  });
  return placements;
}

function getLocationKey(event) {
  if (event.location) return formatLocationLabel(event.location);
  if (event.room) return formatRoomLabel(event.room);
  return "場所不明";
}

const PRINCE_ROOM_LABELS = [
  "第1王子 ベンジャミン", "第2王子 カミーラ", "第3王子 チョウライ", "第4王子 ツェリードニヒ",
  "第5王子 ツベッパ", "第6王子 タイソン", "第7王子 ルズールス", "第8王子 サレサレ",
  "第9王子 ハルケンブルグ", "第10王子 カチョウ", "第11王子 フウゲツ", "第12王子 モモゼ",
  "第13王子 マラヤーム", "第14王子 ワブル"
];

const ROOM_AREA_DEFINITIONS = [
  { id: "ceremony", label: "出航セレモニー会場", group: "主要会場" },
  ...Array.from({ length: 14 }, (_, index) => {
    const room = String(1001 + index);
    return {
      id: `room-${room}`,
      label: `${room}号室｜${PRINCE_ROOM_LABELS[index]}`,
      room,
      group: "第1層 1001〜1014号室"
    };
  }),
  { id: "layer-1-other", label: "第1層 その他", group: "階層・その他" },
  { id: "layer-2", label: "第2層", group: "階層・その他" },
  { id: "layer-3", label: "第3層", group: "階層・その他" },
  { id: "layer-4", label: "第4層", group: "階層・その他" },
  { id: "layer-5", label: "第5層", group: "階層・その他" },
  { id: "other", label: "船内・船外のその他", group: "階層・その他" },
  { id: "unknown", label: "場所不明", group: "階層・その他" }
];

function getRoomAreaIds(event) {
  const location = getLocationKey(event);
  if (/全王子居室|全室/.test(location)) {
    return ROOM_AREA_DEFINITIONS.filter((area) => area.room).map((area) => area.id);
  }
  const ids = ROOM_AREA_DEFINITIONS
    .filter((area) => area.room && location.includes(`${area.room}号室`))
    .map((area) => area.id);

  if (/出航セレモニー会場/.test(location)) ids.push("ceremony");

  if (/司法|捜査室|検察|裁判所/.test(location)) {
    ids.push("layer-2");
  }
  if (/第2層/.test(location)) {
    ids.push("layer-2");
  } else if (/第3層|3101号室|中央警察署/.test(location)) {
    ids.push("layer-3");
  } else if (/第4層|シネコン|シュウ＝ウ一家/.test(location)) {
    ids.push("layer-4");
  } else if (/第5層|シャ＝ア一家/.test(location)) {
    ids.push("layer-5");
  }

  if (ids.length === 0 && /第1層|1層|V\.VIP|VIP|王子居住/.test(location)) {
    ids.push("layer-1-other");
  }

  if (ids.length === 0) ids.push(location === "場所不明" ? "unknown" : "other");
  return [...new Set(ids)];
}

function filterTimelineByEventLocation(event) {
  const areaIds = getRoomAreaIds(event);
  const destination = areaIds.length > 1 ? "all" : areaIds[0] || "other";
  const roomFilter = document.getElementById("roomFilter");
  if (Array.from(roomFilter.options).some((option) => option.value === destination)) {
    roomFilter.value = destination;
  }
  activeTimelinePeriodId = "all";
  activatePrimaryView("timeline", true);
  applyFilter();
  document.querySelector(".timeline-controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createParticipantChip(token, stopPropagation = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "participant-chip";
  btn.textContent = formatRoyalName(token);
  btn.title = `${formatRoyalName(token)}の全期間の出来事を表示`;
  btn.addEventListener("click", (event) => {
    if (stopPropagation) event.stopPropagation();
    document.getElementById("participantFilter").value = token;
    activeTimelinePeriodId = "all";
    activatePrimaryView("timeline", true);
    applyFilter();
    document.querySelector(".timeline-active-filters")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  return btn;
}

// 同時刻の別の場面（simultaneous_with）と、同じ出来事を別の話・視点で描いた場面（same_incident_with）。
// ネタバレ非表示のときは、元の出来事より後の話の場面へのリンクを出さない。
function getSimultaneousScenes(event, revealed = spoilersRevealed, field = "simultaneous_with") {
  return (event[field] || [])
    .map((id) => eventsData.find((entry) => entry.id === id))
    .filter((scene) => scene && scene.id !== event.id && (revealed || scene.chapter <= event.chapter))
    .sort((a, b) => sortKey(a) - sortKey(b));
}

function fillSimultaneousScenes(block, event) {
  block.replaceChildren();
  const field = block.dataset.field || "simultaneous_with";
  const scenes = getSimultaneousScenes(event, spoilersRevealed, field);
  block.hidden = scenes.length === 0;
  if (!scenes.length) return;
  const heading = document.createElement("span");
  heading.className = "simultaneous-scenes-label";
  heading.textContent = field === "same_incident_with" ? "同じ出来事を別の視点で描いた場面：" : "同時刻の別の場面：";
  block.appendChild(heading);
  scenes.forEach((scene, index) => {
    if (index > 0) block.appendChild(document.createTextNode(" / "));
    const url = new URL(location.href);
    url.pathname = siteRootUrl.pathname;
    [...url.searchParams.keys()].filter((key) => /^[ct]_/.test(key) || ["person", "event"].includes(key)).forEach((key) => url.searchParams.delete(key));
    url.hash = "timeline";
    url.searchParams.set("event", scene.id);
    const link = document.createElement("a");
    link.className = "simultaneous-scene-link";
    link.href = url.href;
    const text = scene.title || scene.description;
    link.textContent = `第${scene.chapter}話 ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`;
    link.title = `第${scene.chapter}話：${scene.description}`;
    link.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      showDetailModal(scene.id, "event", scene);
    });
    block.appendChild(link);
  });
}

function makeSimultaneousScenesBlock(event, field = "simultaneous_with") {
  const block = document.createElement("p");
  block.className = field === "same_incident_with" ? "simultaneous-scenes same-incident-scenes" : "simultaneous-scenes";
  block.dataset.eventId = event.id;
  if (field !== "simultaneous_with") block.dataset.field = field;
  fillSimultaneousScenes(block, event);
  return block;
}

// ネタバレ設定を切り替えたら、表示中の同時刻リンクを作り直す。
document.addEventListener("spoiler-visibility-change", () => {
  document.querySelectorAll(".simultaneous-scenes[data-event-id]").forEach((block) => {
    const event = eventsData.find((entry) => entry.id === block.dataset.eventId);
    if (event) fillSimultaneousScenes(block, event);
  });
});

function createTimelineCard(event) {
  const item = document.createElement("article");
  const typeClass = event.type ? `type-${event.type}` : "";
  item.className = `timeline-item ${typeClass}`;

  const title = document.createElement("h3");
  title.textContent = getEventHeadline(event);

  const typeTag = document.createElement("span");
  typeTag.className = "event-type";
  typeTag.textContent = event.type || "出来事";
  title.appendChild(typeTag);
  item.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "meta";

  const addMeta = (text) => {
    const span = document.createElement("span");
    span.textContent = text;
    meta.appendChild(span);
  };

  addMeta(getChapterLabel(event));
  if (event.day != null) addMeta(CharacterFacts.dayLabel(event));
  const timeLabel = getTimeLabel(event);
  if (timeLabel) addMeta(`時刻: ${timeLabel}`);
  else {
    const estimate = inferredTimePlacements.get(event.id);
    if (estimate) {
      addMeta(`時刻: ${estimate.label}`);
    }
  }
  addMeta(`場所: ${getLocationKey(event)}`);
  const certaintyBadge = makeCertaintyBadge(event);
  if (certaintyBadge) meta.appendChild(certaintyBadge);

  const participantWrapper = document.createElement("div");
  participantWrapper.className = "participant-list";
  participantWrapper.textContent = "関係人物: ";
  (event.characters || []).forEach((token, i) => {
    if (i > 0) participantWrapper.appendChild(document.createTextNode(" / "));
    participantWrapper.appendChild(createParticipantChip(token));
  });

  meta.appendChild(participantWrapper);
  item.appendChild(meta);
  if ((event.simultaneous_with || []).length) item.appendChild(makeSimultaneousScenesBlock(event));
  if ((event.same_incident_with || []).length) item.appendChild(makeSimultaneousScenesBlock(event, "same_incident_with"));

  if (event.notes) {
    const detail = document.createElement("p");
    detail.textContent = formatPublicDetailText(event.notes);
    if (detail.textContent) item.appendChild(detail);
  }

  if ((event.revealed_facts || []).length > 0) {
    const facts = document.createElement("p");
    facts.className = "event-facts";
    facts.textContent = `分かったこと: ${event.revealed_facts.join(" / ")}`;
    item.appendChild(facts);
  }

  CharacterFacts.questionSections(event, eventsData).forEach(section => {
    const mysteries = document.createElement("p");
    mysteries.className = "event-mysteries";
    mysteries.textContent = `${section.heading}: ${section.lines.join(" / ")}`;
    item.appendChild(mysteries);
  });

  return item;
}

function getUniqueValues(list, key) {
  return [...new Set(list.map((item) => item[key]))].filter(Boolean).sort();
}

function getUniqueParticipants(events) {
  return [...new Set(events.flatMap((e) => e.characters || []))];
}

const EVENT_TYPE_GROUPS = [
  { id: "nen", label: "念・守護霊獣" },
  { id: "incident", label: "戦闘・事件" },
  { id: "information", label: "情報・調査" },
  { id: "conversation", label: "会話・交渉" },
  { id: "movement", label: "移動・配置" },
  { id: "planning", label: "指示・計画" },
  { id: "system", label: "制度・儀式" },
  { id: "other", label: "その他" }
];

function getEventTypeGroup(event) {
  const text = `${event.type || ""} ${event.description || ""}`;
  if (/念|守護霊獣|霊獣|鳴動|空間異常/.test(text)) return "nen";
  if (/移動|配置|配属|展開|交代|帰還|脱出|籠城|訪問|警護体制|人員離脱/.test(text)) return "movement";
  if (/儀式|契約|辞退|継承条件|定時報告|緊急放送/.test(text)) return "system";
  if (/殺|死亡|自死|暗殺|襲撃|戦闘|交戦|攻撃|制圧|拘束|拉致|呪詛|発症|異変|異常/.test(text)) return "incident";
  if (/情報|捜査|偵察|確認|発覚|判明|遠隔視|能力判断|感染|観察/.test(text)) return "information";
  if (/会議|会合|協議|交渉|面会|対話|会話|発言|説明|共闘|連絡|選択/.test(text)) return "conversation";
  if (/命令|指示|決定|計画|準備|方針|警戒/.test(text)) return "planning";
  return "other";
}

function applyFilter() {
  const selectedRoom = document.getElementById("roomFilter").value;
  const selectedType = document.getElementById("typeFilter").value;
  const selectedParticipant = document.getElementById("participantFilter").value;
  const selectedChapter = document.getElementById("chapterFilter").value;
  const selectedSeries = document.getElementById("seriesFilter").value;

  const filtered = eventsData.filter((event) => {
    const roomMatch = selectedRoom === "all" || getRoomAreaIds(event).includes(selectedRoom);
    const typeMatch = selectedType === "all" || getEventTypeGroup(event) === selectedType;
    const participantMatch = selectedParticipant === "all"
      || (event.characters || []).includes(selectedParticipant);
    const chapterMatch = selectedChapter === "all" || String(event.chapter) === selectedChapter;
    const seriesMatch = selectedSeries === "all" || event.series === selectedSeries;
    return roomMatch && typeMatch && participantMatch && chapterMatch && seriesMatch
      && !(document.getElementById("hideHypothesisEvents")?.checked && event.is_estimate);
  });

  filteredEventsData = filtered;
  timelineVisibleCount = 30;
  renderTimelineActiveFilters();
  renderActiveTimelineView();
  updateViewPermalink();
}

function renderTimelineActiveFilters() {
  const container = document.getElementById("timelineActiveFilters");
  if (!container) return;
  container.innerHTML = "";
  const selectedRoom = document.getElementById("roomFilter").value;
  const selectedParticipant = document.getElementById("participantFilter").value;
  const selectedChapter = document.getElementById("chapterFilter").value;
  const selectedSeries = document.getElementById("seriesFilter").value;
  const filters = [];
  const selectedType = document.getElementById("typeFilter").value;
  if (selectedType !== "all") {
    filters.push({ label: `種類：${EVENT_TYPE_GROUPS.find((group) => group.id === selectedType)?.label || selectedType}`, target: "typeFilter" });
  }
  if (activeTimelineView === "schedule" && activeTimelinePeriodId !== "all") {
    filters.push({ label: `日付：${TIMELINE_PERIODS.find((period) => period.id === activeTimelinePeriodId)?.label || activeTimelinePeriodId}`, target: "period" });
  }
  if (selectedRoom !== "all") {
    const room = ROOM_AREA_DEFINITIONS.find((area) => area.id === selectedRoom);
    filters.push({ label: `場所：${room?.label || selectedRoom}`, target: "roomFilter" });
  }
  if (selectedParticipant !== "all") {
    filters.push({ label: `人物：${formatRoyalName(selectedParticipant)}`, target: "participantFilter" });
  }
  if (selectedChapter !== "all") {
    filters.push({ label: `第${selectedChapter}話`, target: "chapterFilter" });
  }
  if (selectedSeries !== "all") {
    filters.push({ label: `一連の出来事：${selectedSeries}`, target: "seriesFilter" });
  }
  if (filters.length === 0) {
    const guide = document.createElement("p");
    guide.textContent = "各イベントの場所・人物タグを押すと、その履歴だけに絞り込めます。";
    container.appendChild(guide);
    return;
  }
  const label = document.createElement("span");
  label.className = "timeline-active-filters-label";
  label.textContent = "絞り込み中";
  container.appendChild(label);
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "timeline-active-filter";
    button.textContent = `${filter.label} ×`;
    button.title = `${filter.label}の絞り込みを解除`;
    button.addEventListener("click", () => {
      if (filter.target === "period") activeTimelinePeriodId = "all";
      else document.getElementById(filter.target).value = "all";
      applyFilter();
    });
    container.appendChild(button);
  });
}

function getTimelineEventsIgnoringType() {
  const selectedRoom = document.getElementById("roomFilter").value;
  const selectedParticipant = document.getElementById("participantFilter").value;
  const selectedChapter = document.getElementById("chapterFilter").value;
  const selectedSeries = document.getElementById("seriesFilter").value;
  return eventsData.filter((event) => {
    const roomMatch = selectedRoom === "all" || getRoomAreaIds(event).includes(selectedRoom);
    const participantMatch = selectedParticipant === "all"
      || (event.characters || []).includes(selectedParticipant);
    const chapterMatch = selectedChapter === "all" || String(event.chapter) === selectedChapter;
    const seriesMatch = selectedSeries === "all" || event.series === selectedSeries;
    const periodMatch = activeTimelinePeriodId === "all" || getEventPeriodId(event) === activeTimelinePeriodId;
    return roomMatch && participantMatch && chapterMatch && seriesMatch && periodMatch
      && !(document.getElementById("hideHypothesisEvents")?.checked && event.is_estimate);
  });
}

function refreshTypeAvailability() {
  const typeFilter = document.getElementById("typeFilter");
  if (!typeFilter?.setAvailability) return false;
  const counts = getTimelineEventsIgnoringType().reduce((result, event) => {
    const group = getEventTypeGroup(event);
    result[group] = (result[group] || 0) + 1;
    return result;
  }, {});
  typeFilter.setAvailability(counts);
  return false;
}

function resetFilters() {
  document.getElementById("roomFilter").value = "all";
  document.getElementById("typeFilter").value = "all";
  document.getElementById("participantFilter").value = "all";
  document.getElementById("chapterFilter").value = "all";
  document.getElementById("seriesFilter").value = "all";
  document.getElementById("timelineSortOrder").value = "asc";
  if (document.getElementById("hideHypothesisEvents")) document.getElementById("hideHypothesisEvents").checked = false;
  if (document.getElementById("timeDisplayMode")) document.getElementById("timeDisplayMode").value = "all";
  activeTimelinePeriodId = "all";
  applyFilter();
}

function setupFilters() {
  const roomFilter = document.getElementById("roomFilter");
  const typeFilter = document.getElementById("typeFilter");
  const participantFilter = document.getElementById("participantFilter");
  const chapterFilter = document.getElementById("chapterFilter");
  const seriesFilter = document.getElementById("seriesFilter");

  [...new Set(ROOM_AREA_DEFINITIONS.map((area) => area.group))].forEach((groupLabel) => {
    const group = document.createElement("optgroup");
    group.label = groupLabel;
    ROOM_AREA_DEFINITIONS.filter((area) => area.group === groupLabel).forEach((area) => {
      const opt = document.createElement("option");
      opt.value = area.id;
      opt.textContent = area.label;
      group.appendChild(opt);
    });
    roomFilter.appendChild(group);
  });

  EVENT_TYPE_GROUPS.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type.id;
    opt.textContent = type.label;
    typeFilter.appendChild(opt);
  });
  pillify("typeFilter");

  getUniqueParticipants(eventsData)
    .sort((a, b) => formatRoyalName(a).localeCompare(formatRoyalName(b), "ja"))
    .forEach((token) => {
      const opt = document.createElement("option");
      opt.value = token;
      opt.textContent = formatRoyalName(token);
      participantFilter.appendChild(opt);
    });

  [...new Set([...eventsData.map((event) => event.chapter), ...UNCOLLECTED_CHAPTERS.keys()])].sort((a, b) => a - b).forEach((chapter) => {
    const option = document.createElement("option");
    option.value = String(chapter);
    const uncollected = !eventsData.some((event) => event.chapter === chapter) && UNCOLLECTED_CHAPTERS.get(chapter);
    option.textContent = uncollected ? `第${chapter}話（未収録・${uncollected}）` : `第${chapter}話`;
    chapterFilter.appendChild(option);
  });
  [...new Set(eventsData.map((event) => event.series).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")).forEach((series) => {
    const option = document.createElement("option");
    option.value = series;
    option.textContent = series;
    seriesFilter.appendChild(option);
  });

  participantFilter.addEventListener("change", applyFilter);
  document.getElementById("roomFilter").addEventListener("change", applyFilter);
  chapterFilter.addEventListener("change", () => {
    if (chapterFilter.value !== "all") activeTimelinePeriodId = "all";
    applyFilter();
  });
  seriesFilter.addEventListener("change", applyFilter);
  document.getElementById("typeFilter").addEventListener("change", applyFilter);
  document.getElementById("timelineSortOrder").addEventListener("change", applyFilter);
  document.getElementById("hideHypothesisEvents").addEventListener("change", applyFilter);
  document.getElementById("timeDisplayMode").addEventListener("change", applyFilter);
  document.getElementById("clearFilters").addEventListener("click", resetFilters);
  document.getElementById("timelineLoadMore")?.addEventListener("click", () => {
    timelineVisibleCount += 30;
    renderTimeline(filteredEventsData);
  });

  applyFilter();
}

function renderActiveTimelineView() {
  const events = filteredEventsData;
  if (activeTimelineView === "schedule") {
    renderTimelineSchedule(events);
  } else if (activeTimelineView === "chapters") {
    renderTimelineChapters(events);
  }
}

function renderTimelineChapters(events) {
  const container = document.getElementById("chapterEventGroups");
  container.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("p");
    empty.textContent = getUncollectedChapterMessage() || "条件に一致する出来事はありません。";
    container.appendChild(empty);
    return;
  }
  const grouped = new Map();
  events.forEach((event) => {
    if (!grouped.has(event.chapter)) grouped.set(event.chapter, []);
    grouped.get(event.chapter).push(event);
  });
  const descending = document.getElementById("timelineSortOrder").value === "desc";
  const chapters = [...grouped.keys()].sort((a, b) => descending ? b - a : a - b);
  const uncollected = [...UNCOLLECTED_CHAPTERS.keys()];
  const gapLow = Math.min(...uncollected), gapHigh = Math.max(...uncollected);
  chapters.forEach((chapter, index) => {
    const previous = chapters[index - 1];
    if (previous != null && Math.min(previous, chapter) < gapLow && Math.max(previous, chapter) > gapHigh) {
      const gap = document.createElement("p");
      gap.className = "schedule-note chapter-gap-note";
      gap.textContent = `※ ${UNCOLLECTED_RANGE_LABEL}。この間の出来事は登録していません。`;
      container.appendChild(gap);
    }
    const group = document.createElement("details");
    group.className = "chapter-group";
    group.open = chapters.length === 1 || index === 0;
    const heading = document.createElement("summary");
    heading.textContent = `第${chapter}話 — ${grouped.get(chapter).length}件の出来事`;
    const list = document.createElement("div");
    list.className = "chapter-event-list";
    const chapterEvents = grouped.get(chapter).slice().sort((a, b) => descending ? sortKey(b) - sortKey(a) : sortKey(a) - sortKey(b));
    chapterEvents.forEach((event) => list.appendChild(createScheduleEventCard(event, getTimelineTimePlacement(event))));
    group.append(heading, list);
    container.appendChild(group);
  });
}

function activateTimelineView(view, moveFocus = false) {
  const tabs = Array.from(document.querySelectorAll(".timeline-view-tab"));
  const selectedTab = tabs.find((tab) => tab.dataset.view === view);
  if (!selectedTab) return;

  activeTimelineView = view;
  const isQuestions = view === "questions";
  document.getElementById("timelineControls").hidden = isQuestions;
  document.getElementById("timelineFilterToggle")?.toggleAttribute("hidden", isQuestions);
  document.getElementById("timelineActiveFilters").hidden = isQuestions;
  if (view !== "schedule") document.getElementById("typeFilter")?.setAvailability?.(null);
  if (view === "schedule" && document.getElementById("chapterFilter").value !== "all") activeTimelinePeriodId = "all";
  tabs.forEach((tab) => {
    const active = tab === selectedTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel) panel.hidden = !active;
  });

  renderTimelineActiveFilters();
  renderActiveTimelineView();
  if (moveFocus) selectedTab.focus();
}

function setupTimelineTabs() {
  const periodSelect = document.getElementById("timelinePeriodSelect");
  TIMELINE_PERIODS.forEach(period => {
    const option = document.createElement("option");
    option.value = period.id;
    option.textContent = period.label;
    periodSelect.appendChild(option);
  });
  const jumpToPeriod = id => {
    activeTimelinePeriodId = id;
    document.getElementById("chapterFilter").value = "all";
    applyFilter();
  };
  periodSelect.addEventListener("change", () => jumpToPeriod(periodSelect.value));
  document.getElementById("timelineLatestDay").addEventListener("click", () => {
    const days = eventsData.map(getEventPeriodId).filter(id => /^day-\d+$/.test(id)).map(id => Number(id.slice(4)));
    if (days.length) jumpToPeriod(`day-${Math.max(...days)}`);
  });
  const tabs = Array.from(document.querySelectorAll(".timeline-view-tab"));
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTimelineView(tab.dataset.view));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex == null) return;
      event.preventDefault();
      activateTimelineView(tabs[nextIndex].dataset.view, true);
    });
  });
  activateTimelineView(activeTimelineView);
}

function renderTimeline(events) {
  const container = document.getElementById("timelineList");
  const summary = document.getElementById("timelineResultSummary");
  const loadMore = document.getElementById("timelineLoadMore");
  container.innerHTML = "";
  const visibleEvents = events.slice(0, timelineVisibleCount);
  visibleEvents.forEach((e) => container.appendChild(createTimelineCard(e)));
  summary.textContent = events.length === 0
    ? "条件に一致するイベントはありません。"
    : "絞り込み結果";
  const remaining = events.length - visibleEvents.length;
  loadMore.classList.toggle("hidden", remaining <= 0);
  loadMore.textContent = "さらに表示";
}

const TIMELINE_PERIODS = [
  { id: "all", label: "全部" },
  { id: "preboard", label: "乗船前" },
  { id: "ritual", label: "乗船2か月前（壺中卵の儀）" },
  { id: "day-0", label: "0日目" },
  ...Array.from({ length: 12 }, (_, index) => ({ id: `day-${index + 1}`, label: `${index + 1}日目` })),
  { id: "provisional", label: "411話以降・暫定" },
  { id: "unknown", label: "日付不明" }
];

function inferEventDay(event) {
  return event.day != null ? Number(event.day) : null;
}

function getEventPeriodId(event) {
  if (event.period === "ritual") return "ritual";
  if (event.period === "preboard") return "preboard";
  if (getEventDateCertainty(event) === "provisional") return "provisional";
  if (Number(event.chapter) === 349) return "ritual";
  const day = inferEventDay(event);
  if (day != null) return `day-${Math.max(0, Math.min(12, day))}`;
  if (Number(event.chapter) === 358) return "day-0";
  return "unknown";
}

function renderTimelineSchedule(events) {
  const tabs = document.getElementById("timelinePeriodTabs");
  const container = document.getElementById("timelineSchedule");
  // 作り直す前にフォーカスが日付ボタンにあれば、作り直した後も選択中の日付ボタンへ戻す。
  const restorePeriodFocus = tabs.contains(document.activeElement);
  setupRovingToolbar(tabs);
  tabs.innerHTML = "";
  container.innerHTML = "";
  document.getElementById("timelinePeriodSelect").value = activeTimelinePeriodId;
  if (refreshTypeAvailability()) {
    applyFilter();
    return;
  }
  TIMELINE_PERIODS.forEach((period) => {
    const button = document.createElement("button");
    const active = period.id === activeTimelinePeriodId;
    button.type = "button";
    button.className = `timeline-period-tab${active ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(active));
    button.textContent = period.label;
    button.addEventListener("click", () => {
      activeTimelinePeriodId = period.id;
      applyFilter();
    });
    tabs.appendChild(button);
  });
  if (restorePeriodFocus) tabs.querySelector('button[aria-pressed="true"]')?.focus();

  const selectedPeriod = TIMELINE_PERIODS.find((period) => period.id === activeTimelinePeriodId);
  const selectedEvents = events
    .filter((event) => activeTimelinePeriodId === "all" || getEventPeriodId(event) === activeTimelinePeriodId)
    .slice().sort((a, b) => sortKey(a) - sortKey(b));

  const heading = document.createElement("div");
  heading.className = "schedule-selected-heading";
  const title = document.createElement("h4");
  title.textContent = selectedPeriod.id === "all" ? "全日程" : selectedPeriod.label;
  heading.appendChild(title);
  if (activeTimelinePeriodId === "all") {
    const count = document.createElement("span");
    count.textContent = `${selectedEvents.length}件`;
    heading.appendChild(count);
  } else if (activeTimelinePeriodId === "unknown") {
    const breakdown = document.createElement("span");
    const counts = selectedEvents.reduce((result, event) => {
      const kind = getChronologyKind(event);
      result[kind] = (result[kind] || 0) + 1;
      return result;
    }, {});
    breakdown.textContent = Object.entries(counts).map(([kind, count]) => `${getChronologyKindLabel(kind)} ${count}件`).join("／");
    heading.appendChild(breakdown);
  }
  container.appendChild(heading);

  if (selectedEvents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty-state";
    empty.textContent = getUncollectedChapterMessage() || "条件に一致する出来事はありません。選択中の条件を外すか「すべて解除」を押してください。";
    container.appendChild(empty);
  } else {
    if (selectedEvents.some((event) => event.series === "セレモニー退室時刻（10分間隔の仮定）")) {
      const hypothesisNote = document.createElement("p");
      hypothesisNote.className = "schedule-note";
      hypothesisNote.textContent = "※ 退室時刻は『第9王子ハルケンブルグ14:00、下位王子から10分間隔』という仮説で、第359話の画像に合わせて一部の順序を修正しています（4遺体の発見時に第8王妃とワブルが居室に戻っているため第14王子を12:50に、カチョウの退席時にフウゲツがまだ会場にいるため第10王子13:40・第11王子13:50に入れ替え）。第13王子13:20〜第1王子15:20は仮説のままで、辞退表明は第9王子の退室直前に置いています。退室時刻は推測です。第366話「其々」の各場面は16:00頃の仮配置で、画像で時刻が確認できるのは冒頭の1013号室の場面（出航4時間後）だけです。";
      container.appendChild(hypothesisNote);
    }
    if (selectedEvents.some((event) => event.chapter >= 390 && event.chapter <= 395)
      && selectedEvents.some((event) => event.chapter >= 398 && event.chapter <= 405)) {
      const gapNote = document.createElement("p");
      gapNote.className = "schedule-note chapter-gap-note";
      gapNote.textContent = `※ ${UNCOLLECTED_RANGE_LABEL}のため、この間の出来事は表示されません。`;
      container.appendChild(gapNote);
    }
    container.appendChild(createChronologicalAxis(selectedEvents, {
      showPeriod: activeTimelinePeriodId === "all",
      sortOrder: document.getElementById("timelineSortOrder").value
    }));
  }

  const note = document.createElement("p");
  note.className = "schedule-note";
  note.textContent = "※ 「頃？」は表示順を示す目安で、原作の確定時刻ではありません。「内容は推測」は出来事の内容自体が推測の場合です。根拠のない乗船前の日時は表示せず、出航35日前など明示された日付は時刻と分けて表示します。411話以降の暫定データも区別します。";
  container.appendChild(note);
}

function createScheduleEventCard(event, placement) {
  const item = document.createElement("article");
  item.className = "schedule-event";
  item.setAttribute("role", "button");
  item.tabIndex = 0;
  const location = document.createElement("button");
  location.type = "button";
  location.className = "schedule-event-location";
  location.textContent = getLocationKey(event);
  location.title = `${getLocationKey(event)}でタイムラインを絞り込む`;
  location.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    filterTimelineByEventLocation(event);
  });
  const chapter = document.createElement("small");
  chapter.className = "schedule-event-chapter";
  chapter.textContent = getChapterLabel(event);
  const description = document.createElement("span");
  description.textContent = getEventHeadline(event);
  const participants = document.createElement("small");
  participants.textContent = (event.characters || []).map(formatRoyalName).join(" / ") || "人物不明";
  item.appendChild(description);
  if (event.summary) {
    const summary = document.createElement("p");
    summary.textContent = event.summary;
    item.appendChild(summary);
  }
  item.append(location, chapter);
  // 確認状態は例外だけをバッジにする（内容の推測もこのリボンに一本化）。
  const ribbon = makeEventReviewRibbon(event, placement, false);
  if (getEventPeriodId(event) === "unknown") ribbon.appendChild(makeChronologyBadge(event));
  if (ribbon.childElementCount) item.appendChild(ribbon);
  const participantTags = document.createElement("div");
  participantTags.className = "participant-list schedule-participants";
  (event.characters || []).forEach((token) => participantTags.appendChild(createParticipantChip(token, true)));
  if (participantTags.childElementCount === 0) participantTags.appendChild(participants);
  item.appendChild(participantTags);
  item.addEventListener("click", (clickEvent) => {
    if (clickEvent.target.closest("button")) return;
    modalReturnFocus = item;
    showDetailModal(event.id, "event", event);
  });
  item.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
    keyEvent.preventDefault();
    modalReturnFocus = item;
    showDetailModal(event.id, "event", event);
  });
  return item;
}

// 全データで配置を決めてから絞る。描写順による位置は時計時刻には変換しない。
function getChronologicalEntries(events, sortOrder = "asc") {
  const requested = new Map(events.map((event) => [event.id, event]));
  const universe = new Map(eventsData.map((event) => [event.id, event]));
  requested.forEach((event, id) => universe.set(id, event));
  const periods = new Map();
  universe.forEach((event) => {
    const periodId = getEventPeriodId(event);
    if (!periods.has(periodId)) periods.set(periodId, []);
    periods.get(periodId).push({ event, placement: getTimelineTimePlacement(event) });
  });
  const ordered = [];
  TIMELINE_PERIODS.filter((period) => period.id !== "all").forEach((period) => {
    const narrative = (periods.get(period.id) || []).sort((a, b) => sortKey(a.event) - sortKey(b.event));
    const timed = narrative.filter((entry) => entry.placement).sort((a, b) =>
      a.placement.minutes - b.placement.minutes || sortKey(a.event) - sortKey(b.event));
    const timedSlots = new Map(timed.map((entry, index) => [entry.event.id, index * 2]));
    const entries = narrative.map((entry, index) => {
      if (entry.placement) return { ...entry, slot: timedSlots.get(entry.event.id) };
      const explicitBefore = narrative.find((candidate) => candidate.event.id === entry.event.time_before_event_id);
      const explicitAfter = narrative.find((candidate) => candidate.event.id === entry.event.time_after_event_id);
      const before = narrative.slice(0, index).filter((candidate) => candidate.placement).at(-1);
      const after = narrative.slice(index + 1).find((candidate) => candidate.placement);
      // 確認済みの前後関係を優先。残りは描写上の隣接場面の間に置く。
      const boundary = explicitBefore?.placement ? explicitBefore : null;
      const afterBoundary = explicitAfter?.placement ? explicitAfter : null;
      const slot = boundary ? timedSlots.get(boundary.event.id) - 1
        : afterBoundary ? timedSlots.get(afterBoundary.event.id) + 1
        : before && after && before.placement.minutes <= after.placement.minutes ? timedSlots.get(after.event.id) - 1
        : before ? timedSlots.get(before.event.id) + 1
        : after ? timedSlots.get(after.event.id) - 1
        : 0;
      const label = entry.event.relative_days_before_departure != null ? `出航${entry.event.relative_days_before_departure}日前`
        : `第${entry.event.chapter}話・描写順`;
      return { ...entry, slot, relativeLabel: label };
    }).sort((a, b) => a.slot - b.slot || sortKey(a.event) - sortKey(b.event));
    // 前後両方の制約を同時に満たす。依存関係がなければ元の時計・描写順を保つ。
    const rank = new Map(entries.map((entry, index) => [entry.event.id, index]));
    const successors = new Map(entries.map((entry) => [entry.event.id, new Set()]));
    const indegree = new Map(entries.map((entry) => [entry.event.id, 0]));
    const addConstraint = (beforeId, afterId) => {
      if (!successors.has(beforeId) || !successors.has(afterId) || successors.get(beforeId).has(afterId)) return;
      successors.get(beforeId).add(afterId);
      indegree.set(afterId, indegree.get(afterId) + 1);
    };
    entries.forEach(({ event }) => {
      if (event.time_before_event_id) addConstraint(event.id, event.time_before_event_id);
      if (event.time_after_event_id) addConstraint(event.time_after_event_id, event.id);
    });
    const ready = entries.filter((entry) => indegree.get(entry.event.id) === 0);
    const constrained = [];
    while (ready.length) {
      ready.sort((a, b) => rank.get(a.event.id) - rank.get(b.event.id));
      const entry = ready.shift();
      constrained.push(entry);
      successors.get(entry.event.id).forEach((id) => {
        indegree.set(id, indegree.get(id) - 1);
        if (indegree.get(id) === 0) ready.push(entries[rank.get(id)]);
      });
    }
    if (constrained.length === entries.length) entries.splice(0, entries.length, ...constrained);
    else console.warn("タイムラインの前後関係に循環があります", period.id);
    ordered.push(...entries.filter((entry) => requested.has(entry.event.id)));
  });
  return sortOrder === "desc" ? ordered.reverse() : ordered;
}

function createChronologicalAxis(events, { showPeriod = true, sortOrder = "asc" } = {}) {
  const orderedEvents = getChronologicalEntries(events, sortOrder);
  const groups = [];
  orderedEvents.forEach((entry) => {
    const { event, placement, relativeLabel, slot } = entry;
    const key = placement
      ? `${getEventPeriodId(event)}:${getEventDateCertainty(event)}:${placement.estimated ? "estimated" : "exact"}:${placement.minutes}`
      : `${getEventPeriodId(event)}:relative:${slot}:${relativeLabel}`;
    // 離れた場面を同じラベルだからとまとめ直さず、連続した場面だけを束ねる。
    if (groups.at(-1)?.key !== key) groups.push({ key, entries: [] });
    groups.at(-1).entries.push(entry);
  });
  const axis = document.createElement("div");
  axis.className = "chronological-axis";
  groups.forEach(({ entries: groupEvents }) => {
    const placement = groupEvents[0].placement;
    const row = document.createElement("section");
    row.className = `chronological-row${!placement ? " time-relative" : placement.estimated ? " time-estimated" : ""}`;
    const timeColumn = document.createElement("div");
    timeColumn.className = "chronological-time";
    const period = TIMELINE_PERIODS.find((entry) => entry.id === getEventPeriodId(groupEvents[0].event));
    const timeText = placement?.estimated && document.getElementById?.("timeDisplayMode")?.value === "original"
      ? "順序のみ（仮時刻を非表示）" : placement ? placement.label : groupEvents[0].relativeLabel;
    const periodText = groupEvents[0].event.day != null ? CharacterFacts.dayLabel(groupEvents[0].event) : period?.label || "日付不明";
    timeColumn.textContent = showPeriod ? `${periodText} ${timeText}` : timeText;
    if (placement?.estimated) timeColumn.title = "仮時刻です。原作の確定時計ではありません。日付が未確定の場合は、日付も未確定のままです。";
    const eventGrid = document.createElement("div");
    eventGrid.className = "chronological-events";
    groupEvents.forEach(({ event, placement: eventPlacement }) => {
      eventGrid.appendChild(createScheduleEventCard(event, eventPlacement));
    });
    row.append(timeColumn, eventGrid);
    axis.appendChild(row);
  });
  return axis;
}

function renderCharacterTimeline(character, container) {
  const events = getPersonnelEvents().filter((event) => (event.characters || []).includes(character.id));
  const heading = document.createElement("div");
  heading.className = "directory-person-timeline-heading";
  const title = document.createElement("h4");
  title.textContent = "この人物のタイムライン";
  const count = document.createElement("span");
  count.textContent = `${events.length}件`;
  heading.append(title, count);
  container.appendChild(heading);
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty-state";
    empty.textContent = "この人物に紐づくイベントはまだ登録されていません。";
    container.appendChild(empty);
    return;
  }
  container.appendChild(createChronologicalAxis(events));
  const note = document.createElement("p");
  note.className = "schedule-note";
  note.textContent = "※ 場所はイベントの記録地点で、電話・回想などでは本人の所在を示すとは限りません。「頃？」は表示順を示す目安で、原作の確定時刻ではありません。411話以降の日付は暫定です。";
  container.appendChild(note);
}

function renderPersonTimeline(token, sourceEvents = getPersonnelEvents()) {
  const container = document.getElementById("personTimeline");
  container.innerHTML = "";
  if (!token) {
    const p = document.createElement("p");
    p.className = "timeline-empty-state";
    p.textContent = "表示する人物を選択してください。";
    container.appendChild(p);
    return;
  }
  const filtered = sourceEvents.filter((e) => (e.characters || []).some((c) => c === token));

  if (filtered.length === 0) {
    const p = document.createElement("p");
    p.textContent = `${formatRoyalName(token)} に関わるイベントが見つかりませんでした。`;
    container.appendChild(p);
    return;
  }

  filtered.forEach((e) => {
    const item = document.createElement("div");
    item.className = "person-event";

    const label = e.day != null ? `${getChapterLabel(e)} | ${CharacterFacts.dayLabel(e)}` : getChapterLabel(e);
    const strong = document.createElement("strong");
    strong.textContent = `${label} | ${getEventHeadline(e)}`;
    item.appendChild(strong);

    const meta = document.createElement("span");
    meta.textContent = `${getLocationKey(e)} / ${e.type || "出来事"}`;
    item.appendChild(meta);

    if (e.notes) {
      const p = document.createElement("p");
      p.textContent = formatPublicDetailText(e.notes);
      if (p.textContent) item.appendChild(p);
    }

    container.appendChild(item);
  });
}

function renderTimelineMatrix(events) {
  const container = document.getElementById("timelineMatrix");
  container.innerHTML = "";
  if (events.length === 0) {
    container.textContent = "一致するイベントがありません。";
    return;
  }

  const chapters = [...new Set(events.map((e) => e.chapter))].sort((a, b) => a - b);
  const locations = [...new Set(events.map(getLocationKey))].filter(Boolean).sort();
  const eventsByCell = new Map();
  events.forEach((event) => {
    const key = `${getLocationKey(event)}\u0000${event.chapter}`;
    if (!eventsByCell.has(key)) eventsByCell.set(key, []);
    eventsByCell.get(key).push(event);
  });

  const grid = document.createElement("div");
  grid.className = "matrix-grid";
  grid.style.gridTemplateColumns = `180px repeat(${chapters.length}, 160px)`;

  const blank = document.createElement("div");
  blank.className = "matrix-header-cell";
  blank.textContent = "場所 \\ 話";
  grid.appendChild(blank);

  chapters.forEach((ch) => {
    const h = document.createElement("div");
    h.className = "matrix-header-cell";
    h.textContent = `第${ch}話`;
    grid.appendChild(h);
  });

  locations.forEach((loc) => {
    const locCell = document.createElement("div");
    locCell.className = "matrix-cell matrix-room-cell";
    locCell.textContent = loc;
    grid.appendChild(locCell);

    chapters.forEach((ch) => {
      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      const matched = eventsByCell.get(`${loc}\u0000${ch}`) || [];
      if (matched.length > 0) {
        const typeClass = matched[0].type ? `type-${matched[0].type}` : "";
        cell.classList.add("matrix-event-cell", typeClass);
        const strong = document.createElement("strong");
        strong.textContent = matched.length === 1 ? getEventHeadline(matched[0]) : `${matched.length} 件`;
        const span = document.createElement("span");
        const formattedParticipants = (matched[0].characters || []).map(formatRoyalName).join(" / ");
        span.textContent = matched.length === 1
          ? `${matched[0].type || "出来事"} / ${formattedParticipants}`
          : matched.map((e) => getEventHeadline(e)).join(", ");
        cell.append(strong, span);
      }
      grid.appendChild(cell);
    });
  });

  container.appendChild(grid);
}

function renderGanttChart(events) {
  const container = document.getElementById("ganttChart");
  container.innerHTML = "";
  if (events.length === 0) {
    container.textContent = "イベントがありません。";
    return;
  }

  const keys = events.map((e) => sortKey(e));
  const minKey = Math.min(...keys);
  const maxKey = Math.max(...keys) + 20;
  const range = maxKey - minKey || 1;

  const locations = [...new Set(events.map(getLocationKey))].filter(Boolean).sort();

  locations.forEach((loc) => {
    const locEvents = events.filter((e) => getLocationKey(e) === loc);

    const row = document.createElement("div");
    row.className = "gantt-row";

    const label = document.createElement("div");
    label.className = "gantt-label";
    label.textContent = loc;
    row.appendChild(label);

    const timeline = document.createElement("div");
    timeline.className = "gantt-timeline";

    locEvents.forEach((e) => {
      const bar = document.createElement("div");
      bar.className = `gantt-bar${e.type ? ` type-${e.type}` : ""}`;

      const startKey = sortKey(e);
      const dur = getDuration(e);
      const startPct = ((startKey - minKey) / range) * 100;
      const widthPct = (dur / range) * 100;
      bar.style.left = startPct + "%";
      bar.style.width = Math.max(widthPct, 4) + "%";
      bar.textContent = e.description;
      bar.title = `${getChapterLabel(e)} - ${e.description}`;
      bar.tabIndex = 0;
      bar.setAttribute("role", "button");
      bar.addEventListener("click", () => showDetailModal(e.id, "event", e));
      bar.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showDetailModal(e.id, "event", e);
        }
      });

      timeline.appendChild(bar);
    });

    row.appendChild(timeline);
    container.appendChild(row);
  });
}

// ===== モーダル =====

function setupDetailModal() {
  const modal = document.getElementById("detailModal");
  document.getElementById("modalClose").addEventListener("click", closeDetailModal);
  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) closeDetailModal();
  });
  document.addEventListener("keydown", (event) => {
    if (modal.classList.contains("hidden")) return;
    if (document.getElementById("imageLightbox")?.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDetailModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll(
      "button:not([disabled]), [href], summary, input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )).filter((element) => !element.hidden && !element.closest("[inert]") && element.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function setupEventCreation() {
  document.getElementById("addTimelineEvent").addEventListener("click", showEventCreation);
}

function showEventCreation() {
  const modal = document.getElementById("detailModal");
  const content = document.getElementById("modalContent");
  content.replaceChildren();
  document.getElementById("modalTitle").textContent = "出来事を追加";
  const help = document.createElement("p");
  help.className = "local-editor-help";
  help.textContent = "このPCに保存し、タイムラインへ追加します。公開データには反映しません。推測の時刻は確定時刻と区別してください。";
  const form = document.createElement("form");
  form.className = "local-editor-form local-event-create-form";
  const inputs = new Map();
  const fields = [
    { key: "description", label: "出来事", kind: "textarea", required: true },
    { key: "chapter", label: "話数", kind: "number", required: true },
    { key: "day", label: "日（0〜12日、空欄は未設定）", kind: "number" },
    { key: "time", label: "時刻（空欄可）", kind: "time" },
    { key: "timeCertainty", label: "時刻の確度", kind: "select" },
    { key: "location", label: "場所", kind: "text" },
    { key: "type", label: "種別", kind: "text" },
    { key: "notes", label: "詳細・推測の根拠", kind: "textarea" }
  ];
  fields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "local-editor-label";
    label.textContent = field.label;
    const input = document.createElement(field.kind === "textarea" ? "textarea" : field.kind === "select" ? "select" : "input");
    input.id = `newEvent-${field.key}`;
    if (field.kind === "textarea") input.rows = 3;
    else if (field.kind === "select") {
      for (const [value, text] of [["estimated", "推測時刻"], ["confirmed", "確定時刻"]]) {
        const option = document.createElement("option");
        option.value = value; option.textContent = text; input.appendChild(option);
      }
    } else input.type = field.kind;
    if (field.kind === "number") {
      input.min = field.key === "chapter" ? "1" : "0"; input.step = "1";
      if (field.key === "day") input.max = "12";
    }
    input.required = Boolean(field.required);
    if (field.key === "chapter") input.value = document.getElementById("chapterFilter").value === "all" ? "" : document.getElementById("chapterFilter").value;
    if (field.key === "day" && /^day-\d+$/.test(activeTimelinePeriodId)) input.value = activeTimelinePeriodId.slice(4);
    if (field.key === "type") input.value = "その他";
    label.appendChild(input); form.appendChild(label); inputs.set(field.key, input);
  });
  const estimateLabel = document.createElement("label");
  estimateLabel.className = "new-event-estimate-toggle";
  const estimate = document.createElement("input");
  estimate.type = "checkbox";
  estimateLabel.append(estimate, document.createTextNode("出来事自体も推測として表示"));
  form.appendChild(estimateLabel);

  const people = document.createElement("fieldset");
  people.className = "new-event-people";
  const legend = document.createElement("legend"); legend.textContent = "関係人物（複数選択可）";
  const searchLabel = document.createElement("label"); searchLabel.className = "local-editor-label";
  searchLabel.textContent = "関係人物を探す";
  const search = document.createElement("input"); search.type = "search"; search.placeholder = "名前で絞り込み";
  searchLabel.appendChild(search);
  const selected = document.createElement("div"); selected.className = "new-event-selected-people";
  selected.setAttribute("aria-live", "polite");
  const list = document.createElement("div"); list.className = "new-event-people-list";
  const choices = [];
  charactersData.filter(isDirectoryCharacter).forEach((character) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = character.id;
    const name = getDisplayName(character);
    label.append(checkbox, document.createTextNode(name)); list.appendChild(label);
    choices.push({ character, name, label, checkbox });
  });
  const syncPeople = () => {
    const query = search.value.trim().toLowerCase();
    choices.forEach(({ name, label }) => { label.hidden = Boolean(query) && !name.toLowerCase().includes(query); });
    selected.textContent = choices.filter(({ checkbox }) => checkbox.checked).map(({ name }) => name).join(" / ") || "人物未選択";
  };
  search.addEventListener("input", syncPeople);
  list.addEventListener("change", syncPeople);
  syncPeople(); people.append(legend, searchLabel, selected, list); form.appendChild(people);
  const status = document.createElement("p"); status.className = "local-editor-status"; status.setAttribute("role", "status");
  const actions = document.createElement("div"); actions.className = "local-editor-actions";
  const save = document.createElement("button"); save.type = "submit"; save.className = "local-editor-button";
  save.textContent = "追加して保存";
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "local-editor-button secondary";
  cancel.textContent = "キャンセル"; cancel.addEventListener("click", closeDetailModal);
  actions.append(save, cancel); form.append(actions, status);
  const id = `LOCAL-${crypto.randomUUID()}`;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      const values = Object.fromEntries([...inputs].map(([key, input]) => [key, input.value.trim()]));
      values.chapter = Number(values.chapter);
      values.day = values.day === "" ? null : Number(values.day);
      values.characters = choices.filter(({ checkbox }) => checkbox.checked).map(({ character }) => character.id);
      values.is_estimate = estimate.checked;
      values.chapter_title = eventsData.find((event) => event.chapter === values.chapter)?.chapter_title || null;
      const chapterOrder = Math.max(0, ...eventsData.filter((event) => event.chapter === values.chapter)
        .map((event) => event.chapter_order ?? (parseInt(event.id.split("-")[1], 10) || 0))) + 1;
      const record = buildLocalEventRecord(values, id, chapterOrder);
      const key = `event:${id}`;
      validateCreatedEvent(record, key);
      localDrafts.items[key] = { ...(localDrafts.items[key] || {}), createdRecord: record, updatedAt: new Date().toISOString() };
      if (!await saveLocalDrafts()) {
        status.textContent = "PCに保存できませんでした。ブラウザ内の控えは残っています。再度保存してください。";
        return;
      }
      reopenDetailAfterReload(record, "event");
    } catch (error) {
      status.textContent = error.message;
    } finally { save.disabled = false; }
  });
  content.append(help, form);
  modalReturnFocus = document.activeElement;
  modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open"); inputs.get("description").focus();
}

const SPIRIT_BEAST_EVENT_IDS = {
  P01: ["E349-001"],
  P02: ["E349-001"],
  P03: ["E349-001", "E374-004", "E389-007", "E404-001"],
  P04: ["E349-001", "E384-002", "E385-003"],
  P05: ["E349-001", "E402-002"],
  P06: ["E349-001", "E372-005"],
  P07: ["E349-001"],
  P08: ["E349-001", "E372-004", "E374-003", "E381-003"],
  P09: ["E349-001", "E382-001", "E382-002", "E389-002", "E413-002"],
  P10: ["E349-001", "E383-002", "E400-003"],
  P11: ["E349-001", "E374-002", "E375-004", "E383-002", "E400-003"],
  P12: ["E349-001", "E360-002"],
  P13: ["E349-001", "E372-003", "E372-007", "E375-005"],
  P14: ["E349-001"]
};

function getRelatedEvents(record, category) {
  let id = record.id;
  let name = record.name;
  if (category === "spiritBeast") {
    const prince = charactersData.find((c) => c.name === record.prince);
    id = prince ? prince.id : null;
    const eventIds = new Set(SPIRIT_BEAST_EVENT_IDS[id] || []);
    return getPersonnelEvents().filter((event) => eventIds.has(event.id));
  }
  return getPersonnelEvents().filter((e) => (e.characters || []).some((c) => c === id || c === name));
}

// 配置者 = 現在その王子の部屋・陣営に配置されている全員（camp一致）。
// 雇用主（affiliation）が別の王子・王妃である監視担当も含むため、全員を護衛と呼ばない。
// 一方、position_codeの接頭辞は「誰の私設兵として登録されているか」という台帳上の
// 所属を表すだけで、現在の配置先とは別物（他陣営に潜伏中のスパイなどで両者がズレる）。
function getGuardsForPrince(prince) {
  if (!prince.camp) return [];
  return bodyguardsData.filter((g) => g.camp === prince.camp && !g.setting_only && !g.roster_projection && !g.generated_by);
}

// 配置先（camp）と真の所属（affiliation）が一致しない場合、他陣営からの配置者と判定
function isOutsidePlacement(guard) {
  if (!guard.camp || !guard.affiliation) return false;
  return !guard.affiliation.startsWith(guard.camp.replace(/陣営$/, ""));
}

function getGuideMemoRecords() {
  return [...document.querySelectorAll("#guide > .guide-facts, #guide > .guide-data-section")]
    .map((section) => {
      const id = section.getAttribute("aria-labelledby");
      const title = id && document.getElementById(id)?.textContent.trim();
      return title ? { id, name: `基本情報：${title}` } : null;
    }).filter(Boolean);
}

function normalizeGuideQuery(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/g, " ").trim();
}

function updateGuideSearch() {
  const input = document.getElementById("guideSearch");
  if (!input) return;
  const terms = normalizeGuideQuery(input.value).split(" ").filter(Boolean);
  let available = 0, matches = 0;
  document.querySelectorAll("#guide > .guide-facts, #guide > .guide-data-section").forEach((section) => {
    const allowed = spoilersRevealed || section.classList.contains("guide-facts") || section.classList.contains("guide-initial-setting");
    const match = allowed && terms.every((term) => section.dataset.guideSearchText?.includes(term));
    if (allowed) available++;
    if (match) matches++;
    section.hidden = !match;
    const target = section.getAttribute("aria-labelledby");
    const item = document.querySelector(`[data-guide-target="${target}"]`)?.closest("li");
    if (item) item.hidden = !match;
  });
  document.getElementById("guideSearchStatus").textContent = `${available}項目中${matches}項目を表示${spoilersRevealed ? "" : "（後の情報は非表示）"}`;
  document.getElementById("guideNoResults").hidden = matches !== 0;
  document.getElementById("guideSearchClear").hidden = terms.length === 0;
}

function setupGuideNavigation() {
  document.querySelectorAll("#guide .guide-table-wrap").forEach((wrap) => {
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", `${wrap.closest("section").querySelector("h3").textContent}の表（横にスクロールできます）`);
    const hint = document.createElement("p"); hint.className = "guide-table-hint";
    hint.textContent = "表が横に収まらないときは、左右にスクロールできます。";
    wrap.before(hint);
  });
  // Index authored guidance only. Private memos and dynamically generated current-state tables are excluded.
  document.querySelectorAll("#guide > .guide-facts, #guide > .guide-data-section").forEach((section) => {
    const copy = section.cloneNode(true);
    copy.querySelectorAll(".guide-local-memo, #princeStatusContent, #initialPersonnelContent, #personnelSnapshotContent").forEach((node) => node.remove());
    section.dataset.guideSearchText = normalizeGuideQuery(copy.textContent);
  });
  document.getElementById("guideSearch")?.addEventListener("input", updateGuideSearch);
  document.getElementById("guideSearchClear")?.addEventListener("click", () => {
    const input = document.getElementById("guideSearch"); input.value = ""; updateGuideSearch(); input.focus();
  });
  document.querySelectorAll("[data-guide-target]").forEach((button) => button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.guideTarget);
    if (!target || target.closest("section").hidden) return;
    target.setAttribute("tabindex", "-1"); target.focus({preventScroll:true}); target.scrollIntoView({block:"start"});
  }));
  updateGuideSearch();
}

function setupGuideMemos() {
  if (!memoEditorEnabled()) return;
  for (const record of getGuideMemoRecords()) {
    const container = document.getElementById(record.id).closest("section");
    if (container.querySelector(".guide-local-memo")) continue;
    const details = document.createElement("details");
    details.className = "local-editor-collapsed guide-local-memo";
    const summary = document.createElement("summary");
    summary.textContent = "この項目にメモ";
    details.appendChild(summary);
    renderLocalEditor(details, record, "guide", "inline");
    container.appendChild(details);
  }
}

function renderLocalEditor(container, record, category, view = "modal") {
  // 公開サイト（PC保存なし）では、自分用メモ・編集の欄ごと出さない。
  if (!memoEditorEnabled()) return;
  const recordKey = localRecordKey(record, category);
  const saved = localDrafts.items[recordKey] || {};
  const section = document.createElement("section");
  section.className = "local-editor";

  const heading = document.createElement("h4");
  heading.textContent = category === "guide" ? "自分用メモ" : "自分用メモ・編集";
  const explanation = document.createElement("p");
  explanation.className = "local-editor-help";
  explanation.textContent = draftStorageMode === "file"
    ? "書くと自動でこのPCに保存されます。公開データには反映されません。"
    : "このブラウザに保存されます（他の端末とは共有されません）。まとめて渡すときは、ページ上部の「個人編集用：修正メモ・バックアップ」から「JSONでバックアップ」で書き出してください。";
  section.append(heading, explanation);

  const memoLabel = document.createElement("label");
  memoLabel.className = "local-editor-label";
  memoLabel.textContent = "気付いたことをメモ";
  const memo = document.createElement("textarea");
  memo.rows = 4;
  memo.value = typeof saved.memo === "string" ? saved.memo : "";
  memo.placeholder = category === "guide"
    ? "例：この説明の出典を再確認したい／補足したい情報がある"
    : "例：この時刻は再確認したい／この人物の所属に疑問あり";
  memoLabel.appendChild(memo);

  const memoButton = document.createElement("button");
  memoButton.type = "button";
  memoButton.className = "local-editor-button";
  memoButton.textContent = "今すぐ保存";
  const status = document.createElement("p");
  status.className = "local-editor-status";
  status.setAttribute("role", "status");
  let memoTimer = null;
  async function persistMemo() {
    const text = memo.value.trim();
    const previous = localDrafts.items[recordKey] || {};
    if (text || Object.keys(previous.edits || {}).length > 0) {
      localDrafts.items[recordKey] = { ...previous, memo: text, updatedAt: new Date().toISOString() };
    } else {
      delete localDrafts.items[recordKey];
    }
    const saved = await saveLocalDrafts();
    renderDraftOverview();
    status.textContent = saved
      ? draftStorageMode === "file" ? "PCに保存しました。" : "ブラウザに保存しました。PCへの自動保存は無効です。"
      : "PCに保存できませんでした。ブラウザ内の控えは残っています。";
  }
  memo.addEventListener("input", () => {
    clearTimeout(memoTimer);
    status.textContent = "保存中…";
    memoTimer = setTimeout(() => { memoTimer = null; persistMemo(); }, 650);
  });
  memo.addEventListener("blur", () => {
    if (!memoTimer) return;
    clearTimeout(memoTimer);
    memoTimer = null;
    persistMemo();
  });
  memoButton.addEventListener("click", () => {
    clearTimeout(memoTimer);
    memoTimer = null;
    persistMemo();
  });
  section.append(memoLabel, memoButton, status);

  if (category === "guide") {
    container.appendChild(section);
    return;
  }

  const editor = document.createElement("details");
  editor.className = "local-editor-fields";
  const summary = document.createElement("summary");
  summary.textContent = saved.edits && Object.keys(saved.edits).length > 0
    ? "内容を編集（ローカル編集あり）" : "内容を編集";
  editor.appendChild(summary);
  const form = document.createElement("form");
  form.className = "local-editor-form";
  const inputs = new Map();
  LOCAL_EDIT_FIELDS[category].forEach((field) => {
    const label = document.createElement("label");
    label.className = "local-editor-label";
    label.textContent = field.label;
    const input = field.kind === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (field.kind === "textarea") input.rows = field.key === "notes" ? 5 : 3;
    else input.type = field.kind === "number" ? "number" : field.kind === "time" ? "time" : "text";
    if (field.kind === "number") { input.min = "0"; input.step = "1"; }
    if (field.required) input.required = true;
    input.value = record[field.key] ?? "";
    label.appendChild(input);
    form.appendChild(label);
    inputs.set(field.key, input);
  });
  if (category === "event") {
    const timeHelp = document.createElement("p");
    timeHelp.className = "local-editor-help";
    timeHelp.textContent = "確定時刻と推測時刻は同時に入力できません。根拠がない場合は空欄にしてください。";
    form.appendChild(timeHelp);
  }
  const formStatus = document.createElement("p");
  formStatus.className = "local-editor-status";
  formStatus.setAttribute("role", "status");
  const actions = document.createElement("div");
  actions.className = "local-editor-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "local-editor-button";
  saveButton.textContent = "編集を保存";
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "local-editor-button secondary";
  resetButton.textContent = "この項目の編集を戻す";
  resetButton.disabled = !saved.edits || Object.keys(saved.edits).length === 0;
  actions.append(saveButton, resetButton);
  form.append(actions, formStatus);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (memoTimer) {
      clearTimeout(memoTimer);
      memoTimer = null;
      await persistMemo();
    }
    const values = {};
    for (const field of LOCAL_EDIT_FIELDS[category]) {
      const raw = inputs.get(field.key).value.trim();
      values[field.key] = field.kind === "number" ? (raw === "" ? null : Number(raw))
        : field.kind === "time" ? (raw || null) : raw;
    }
    if (category === "event" && values.time_start && values.time_estimate) {
      formStatus.textContent = "確定時刻か推測時刻のどちらか一方にしてください。";
      return;
    }
    if (category === "event" && (!Number.isInteger(values.day) && values.day !== null)) {
      formStatus.textContent = "日は整数で入力してください。";
      return;
    }
    const original = originalRecords.get(recordKey) || {};
    const edits = {};
    LOCAL_EDIT_FIELDS[category].forEach((field) => {
      const baseline = field.kind === "number" || field.kind === "time"
        ? (original[field.key] ?? null) : (original[field.key] ?? "");
      if (values[field.key] !== baseline) edits[field.key] = values[field.key];
    });
    const previous = localDrafts.items[recordKey] || {};
    if (Object.keys(edits).length || previous.memo || previous.createdRecord) {
      localDrafts.items[recordKey] = { ...previous, edits, updatedAt: new Date().toISOString() };
    } else {
      delete localDrafts.items[recordKey];
    }
    if (!await saveLocalDrafts()) {
      formStatus.textContent = "PCに保存できませんでした。ブラウザ内の控えは残っています。";
      return;
    }
    reopenDetailAfterReload(record, category, view);
  });
  resetButton.addEventListener("click", async () => {
    if (memoTimer) {
      clearTimeout(memoTimer);
      memoTimer = null;
      await persistMemo();
    }
    const previous = localDrafts.items[recordKey] || {};
    if (previous.memo || previous.createdRecord) localDrafts.items[recordKey] = { ...previous, edits: {}, updatedAt: new Date().toISOString() };
    else delete localDrafts.items[recordKey];
    if (!await saveLocalDrafts()) {
      formStatus.textContent = "PCに変更を保存できませんでした。";
      return;
    }
    reopenDetailAfterReload(record, category, view);
  });
  editor.appendChild(form);
  section.appendChild(editor);
  container.appendChild(section);
}

function makeCharacterBeastSection(character) {
  if (character.nen_status === "historical_unorganized") return null;
  const beast = spiritBeastsData.find(b => b.prince === character.name);
  if (!beast) return null;
  const section = document.createElement("section");
  section.className = "directory-spirit-beast";
  const portrait = makeBeastImage(beast.image, beast.name);
  if (portrait) section.appendChild(portrait);
  else section.classList.add("directory-spirit-beast-no-image");
  const text = document.createElement("div");
  const heading = document.createElement("h4");
  heading.textContent = `守護霊獣：${beast.name || "名称不明"}`;
  const type = document.createElement("p");
  type.textContent = `守護霊獣の念系統：${beast.nen_type || "未確認"}`;
  text.append(heading, type, makeReadableBlock(beast.appearance || "外見は未確認"), makeReadableBlock(beast.ability || "能力は未確認"));
  for (const id of beast.source_event_ids || []) {
    const event = eventsData.find(e => e.id === id);
    if (!event) continue;
    const link = document.createElement("a"); link.href = new URL(`?event=${encodeURIComponent(id)}#timeline`, siteRootUrl).href;
    link.textContent = ` 第${event.chapter}話（${getEventVerificationLabel(event)}）`; text.appendChild(link);
  }
  if (beast.usage_image) {
    const usage = makeBeastImage(beast.usage_image, `${beast.name}の使用・顕現場面`);
    if (usage) { usage.classList.add("spirit-beast-usage-image"); text.appendChild(usage); }
    if (beast.usage_image_source) {
      const caption = document.createElement("p"); caption.className = "guide-source-note";
      caption.textContent = beast.usage_image_source; text.appendChild(caption);
    }
  }
  section.appendChild(text); return section;
}

function makeCharacterStatusHistory(character) {
  const rows = CharacterFacts.statusHistoryRows(character, getPersonnelEvents());
  if (!rows.length) return null;
  const section = document.createElement("section"); section.className = "character-status-history";
  const heading = document.createElement("h4"); heading.textContent = "状態の経緯";
  const list = document.createElement("ul"); list.className = "readable-list";
  for (const row of rows) {
    const li = document.createElement("li"); li.textContent = `${row.text}（${row.review}）`;
    if (row.event_id) {
      const link = document.createElement("a"); link.href = new URL(`?event=${encodeURIComponent(row.event_id)}#timeline`, siteRootUrl).href;
      link.textContent = " 根拠の出来事"; li.appendChild(link);
    }
    list.appendChild(li);
  }
  section.append(heading, list); return section;
}

function showDetailModal(name, category, eventData = null) {
  if (["prince", "bodyguard"].includes(category) && charactersData.some((person) => person.id === name)) window.CharacterRoutes?.open(name);
  // 詳細を開いても全画面のネタバレ設定は変えない・保存しない。後の話は詳細内の折りたたみで扱う。
  const modal = document.getElementById("detailModal");
  const wasHidden = modal.classList.contains("hidden");
  const titleEl = document.getElementById("modalTitle");
  const content = document.getElementById("modalContent");
  content.innerHTML = "";

  let record, details;
  let extraSections = [];

  if (category === "event" && eventData) {
    record = eventData;
    titleEl.textContent = getEventHeadline(record);
    const estimatedTime = inferredTimePlacements.get(record.id);
    // 読者向けの順：本文 → いつ・どこ・誰 → 分かったこと・疑問。出典や編集メモは末尾の折りたたみにまとめる。
    const whenLabel = [CharacterFacts.dayLabel(record), getTimeLabel(record) || estimatedTime?.label].filter(Boolean).join(" ");
    details = [
      { label: "本文", value: eventHasMoreText(record) ? record.description : "", readable: true },
      { label: "日時", value: whenLabel },
      { label: "場所", value: getLocationKey(record) },
      { label: "話数", value: getChapterLabel(record) },
      { label: "関係人物", value: getEventCharacterDisplayLabels(record).join(" / ") },
      { label: "陣営", value: (record.camp || []).map(formatRoyalName).join(" / ") },
      { label: "種別", value: record.type || "出来事" }
    ];
    if ((record.revealed_facts || []).length > 0) {
      extraSections.push({ heading: "分かったこと", lines: record.revealed_facts });
    }
    extraSections.push(...CharacterFacts.questionSections(record, eventsData));
    const fromTheory = initialViewUrl.searchParams.get("from_theory");
    if (/^(?:Q00[1-9]|Q01[0-4]|emperor-time)$/.test(fromTheory || "")) {
      const back = document.createElement("a");
      back.href = new URL(`theories/${fromTheory}/#evidence`, siteRootUrl).href;
      const returnUrl = new URL(back.href);
      for (const key of ['q', 'category', 'read']) {
        const value = initialViewUrl.searchParams.get(`theory_${key}`);
        if (value) returnUrl.searchParams.set(key, value);
      }
      back.href = returnUrl.href;
      back.textContent = "参照元の考察記事へ戻る";
      back.className = "event-theory-return";
      content.appendChild(back);
    }
  } else if (category === "spiritBeast") {
    record = spiritBeastsData.find((b) => b.name === name);
    if (!record) return;
    titleEl.textContent = formatDisplayText(record.name);
    details = [
      { label: "対象の王族", value: formatRoyalName(record.prince) },
      { label: "外見・形態", value: record.appearance || "不明" },
      { label: "念系統", value: CharacterFacts.nenTypeLabel(record) },
      { label: "能力", value: record.ability || "不明" }
    ];
  } else if (category === "prince") {
    record = princesData.find((p) => p.id === name);
    if (!record) return;
    titleEl.textContent = `第${record.rank}王子${getDisplayName(record)}`;
    details = [
      { label: "母（王妃）", value: getCharacterAffiliationText(record)?.replace(/^母：/, "") || record.queen || "不明" },
      { label: "年齢", value: record.age != null ? `${record.age}歳` : "不明" },
      { label: "初期配置", value: record.initial_room ? formatRoomLabel(record.initial_room) : "" },
      { label: "状態", value: CharacterFacts.statusLabel(record, getPersonnelEvents()), later: true },
      { label: "最後の所在", value: "latest-location", later: true },
      { label: "本人の念系統", value: CharacterFacts.nenTypeLabel(record), later: true },
      { label: "本人の念能力", value: record.nen_ability || "不明", later: true, readable: true },
      { label: "守護霊獣", value: record.spirit_beast_name || "不明", later: true },
      { label: "陣営メモ", value: formatDisplayText(record.faction_note) || "", later: true, readable: true },
      { label: "備考", value: formatPublicDetailText(record.notes) || "", later: true, readable: true }
    ];
  } else {
    record = getPersonnelSelection(document.getElementById("characterQueenFilter")?.value === "all" ? null : Number(document.getElementById("characterQueenFilter")?.value)).find(g => g.id === name)
      || charactersData.find((g) => g.id === name);
    if (!record) return;
    titleEl.textContent = getDisplayName(record);
    const roleLabel = record.target ? (record.role || "").replace(record.target, "").trim() : record.role || "不明";
    const assignmentRows = CharacterFacts.assignmentRows(record, charactersData);
    details = [
      { label: "分類", value: record.soldier_category === roleLabel ? "" : record.soldier_category || "不明" },
      { label: "所属・配置先", value: getCharacterAffiliationText(record) || formatAffiliation(record) || "不明" },
      { label: "役割", value: roleLabel },
      { label: "担当陣営", value: assignmentRows[0]?.text || (record.camp !== record.affiliation ? formatAssignment(record) : "") },
      { label: "初期配置", value: record.initial_room ? formatRoomLabel(record.initial_room) : "" },
      { label: "選択時点の担当", value: record.roster_view?.assignment || "", later: true },
      { label: "任務", value: record.role?.includes(record.mission) ? "" : formatDisplayText(record.mission) },
      { label: "状態", value: CharacterFacts.statusLabel(record, getPersonnelEvents()), later: true },
      { label: "配置履歴", value: assignmentRows.length > 1 ? assignmentRows.map(entry => entry.text).join("\n") : "", later: true },
      { label: "最後の所在", value: "latest-location", later: true },
      { label: "任務対象", value: record.role?.includes(record.target) ? "" : formatDisplayText(record.target), later: true },
      { label: "念系統", value: record.nen_status === "historical_unorganized" ? "この時点の能力情報は未整理" : CharacterFacts.nenTypeLabel(record), later: true },
      { label: "能力", value: record.nen_status === "historical_unorganized" ? "この時点の能力情報は未整理（当時未判明という意味ではありません）" : record.nen_ability || "不明", later: true, readable: true },
      { label: "念講習会", value: getNenClassLabel(record) || "", later: true },
      { label: "備考", value: formatPublicDetailText(record.notes) || "", later: true, readable: true }
    ];
  }

  if (category === "spiritBeast" && record.image) {
    const modalBeastImage = makeBeastImage(record.image, record.name);
    if (modalBeastImage) {
      modalBeastImage.classList.add("modal-beast-image");
      content.appendChild(modalBeastImage);
    }
  }

  if (category === "spiritBeast" && record.usage_image) {
    const usageHeading = document.createElement("h4");
    usageHeading.textContent = "使用・顕現場面";
    content.appendChild(usageHeading);
    const usageImage = makeBeastImage(record.usage_image, `${record.name}の使用・顕現場面`);
    if (usageImage) {
      usageImage.classList.add("modal-spirit-beast-usage-image");
      if (record.usage_image_source) usageImage.title = record.usage_image_source;
      content.appendChild(usageImage);
    }
  }

  const isPerson = ["prince", "bodyguard"].includes(category);
  if (isPerson && record.roster_view) {
    const period = document.createElement("p");
    period.className = "personnel-modal-period guide-source-note";
    const control = document.getElementById("characterPeriodFilter");
    period.textContent = `名簿の表示時点：${control.selectedOptions[0].textContent}。初期配置は復元を含みます。`;
    content.appendChild(period);
  }
  // 顔画像がある人物だけ、詳細の先頭に拡大できるアバターを置く（頭文字アバターは出さない）。
  if (isPerson && record.image) {
    const label = record.type === "prince" ? `第${record.rank}` : (record.name || "").slice(0, 2);
    const modalAvatar = makeAvatar(label, record.nen_type, record.image, record.image_crop || null, getAvatarZoom(record));
    if (modalAvatar.classList.contains("avatar-zoomable")) {
      modalAvatar.classList.add("modal-character-avatar");
      content.appendChild(modalAvatar);
    }
  }
  // 人物は、後の話の情報をこの詳細の中だけで折りたたむ（全画面の設定は変えない）。
  const later = isPerson ? makeLaterInfoDetails() : null;
  const laterTarget = later || content;
  const makeDetailList = (entries) => {
    const dl = document.createElement("dl");
    dl.className = "detail-list";
    entries.forEach(({ label, value, readable }) => {
      if (!value || value === "—") return;
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      if (value === "latest-location") dd.appendChild(makeLatestLocationContent(record));
      else if (readable) dd.appendChild(makeReadableBlock(value));
      else dd.textContent = value;
      if (label === "配置履歴") dd.className = "assignment-history-value";
      dl.append(dt, dd);
    });
    return dl;
  };
  if (!isPerson) {
    const sourceExcerpts = makeSourceExcerptGallery(record);
    if (sourceExcerpts) content.appendChild(sourceExcerpts);
  }
  content.appendChild(makeDetailList(details.filter((entry) => !entry.later)));
  if (category === "event" && (record.simultaneous_with || []).length) content.appendChild(makeSimultaneousScenesBlock(record));
  if (category === "event" && (record.same_incident_with || []).length) content.appendChild(makeSimultaneousScenesBlock(record, "same_incident_with"));
  if (isPerson) {
    const notice = CharacterFacts.registrationNotice(record);
    if (notice) { const p = document.createElement("p"); p.className = "guide-source-note"; p.textContent = notice; content.appendChild(p); }
    const authorSetting = makeAuthorSettingPanel(record);
    if (authorSetting) content.appendChild(authorSetting);
    content.appendChild(later);
    const sourceExcerpts = makeSourceExcerptGallery(record);
    if (sourceExcerpts) later.appendChild(sourceExcerpts);
    later.appendChild(makeDetailList(details.filter((entry) => entry.later)));
    const knowledge = document.createElement("p"); knowledge.textContent = getNenKnowledgeLabel(record);
    later.appendChild(knowledge);
    if (record.nen_ability_image && isConfirmedNenUser(record)) {
      const abilityImage = makeBeastImage(record.nen_ability_image, `${getDisplayName(record)}の念能力の画像`);
      if (abilityImage) later.appendChild(abilityImage);
      if (record.nen_ability_image_source) { const p = document.createElement("p"); p.className = "guide-source-note"; p.textContent = record.nen_ability_image_source; later.appendChild(p); }
    }
    const beastSection = makeCharacterBeastSection(record);
    if (beastSection) later.appendChild(beastSection);
    const statusHistory = makeCharacterStatusHistory(record);
    if (statusHistory) later.appendChild(statusHistory);
    later.appendChild(makeCharacterReviewPanel(record));
    later.appendChild(makeEditorialStatusDetails([
      `人物ID：${record.id}`,
      CharacterFacts.statusEditorialNote(record, eventsData),
      ...getNenAbilityEditorialLines(record),
      "原作の確認状況は出来事ごとに記録しています。収録件数や索引があることは、原作の全件照合を意味しません。"
    ]));
  }

  extraSections.forEach(({ heading, lines }) => {
    const h4 = document.createElement("h4");
    h4.textContent = heading;
    content.appendChild(h4);
    const ul = document.createElement("ul");
    lines.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    });
    content.appendChild(ul);
  });
  // 出来事の出典・確認状況・編集メモは、本文と分かったことの後に1つの折りたたみで出す。
  if (category === "event") content.appendChild(makeEventSourcePanel(record));

  const editorTarget = document.createElement("div");

  if (category === "prince") {
    const guards = getGuardsForPrince(record);
    if (guards.length > 0) {
      const guardDetails = document.createElement("details");
      guardDetails.className = "related-events-spoiler";

      const outsideCount = guards.filter(isOutsidePlacement).length;
      const guardSummary = document.createElement("summary");
      guardSummary.textContent = outsideCount > 0
        ? `配置者（${guards.length}件・他陣営からの配置 ${outsideCount}件含む）`
        : `配置者（${guards.length}件）`;
      guardDetails.appendChild(guardSummary);

      const guardList = document.createElement("div");
      guardList.className = "event-list";
      guards.forEach((g) => {
        const outside = isOutsidePlacement(g);
        const item = document.createElement("div");
        item.className = "event-item clickable";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.addEventListener("click", () => showDetailModal(g.id, "bodyguard"));
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showDetailModal(g.id, "bodyguard");
          }
        });
        const strong = document.createElement("strong");
        strong.textContent = g.name;
        if (outside) strong.appendChild(makeOutsidePlacementBadge(g));
        const meta = document.createElement("span");
        meta.textContent = `所属: ${g.affiliation || "不明"} / ${g.role || "役割不明"}`;
        const p = document.createElement("p");
        p.textContent = g.notes || "";
        item.append(strong, meta, p);
        guardList.appendChild(item);
      });
      guardDetails.appendChild(guardList);
      laterTarget.appendChild(guardDetails);
    }
  }

  const relatedEvents = category !== "event" ? getRelatedEvents(record, category) : [];

  if (relatedEvents.length > 0) {
    const details = document.createElement("details");
    details.className = "related-events-spoiler";

    const summary = document.createElement("summary");
    summary.textContent = "関連イベント";
    details.appendChild(summary);

    const list = document.createElement("div");
    list.className = "event-list";
    relatedEvents
      .slice()
      .sort((a, b) => sortKey(a) - sortKey(b))
      .forEach((e) => {
        const item = document.createElement("div");
        item.className = "event-item";
        const label = e.day != null ? `${getChapterLabel(e)}（${CharacterFacts.dayLabel(e)}）` : getChapterLabel(e);
        const strong = document.createElement("strong");
        strong.textContent = `${label} | ${e.description}`;
        const meta = document.createElement("span");
        meta.textContent = `${getLocationKey(e)} / ${e.type || "出来事"}`;
        const p = document.createElement("p");
        p.textContent = formatPublicDetailText(e.notes) || "";
        item.append(strong, meta);
        if (p.textContent) item.appendChild(p);
        list.appendChild(item);
      });
    details.appendChild(list);
    laterTarget.appendChild(details);
  }

  renderLocalEditor(editorTarget, record, category);
  content.appendChild(editorTarget);

  if (wasHidden) modalReturnFocus = document.activeElement;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setModalBackgroundInert(true);
  document.getElementById("modalClose").focus();
}

function closeDetailModal(fromHistory = false) {
  if (fromHistory !== true && window.CharacterRoutes?.requestClose()) return;
  const modal = document.getElementById("detailModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setModalBackgroundInert(false);
  if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus({ preventScroll: true });
  modalReturnFocus = null;
}

function setupBackToTop() {
  const button = document.getElementById("backToTop");
  const updateVisibility = () => button.classList.toggle("hidden", window.scrollY < 900);
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();
}

function renderPrinceStatusGuide(container) {
  container.replaceChildren();
  const counts = { "存命表記": 0, "死亡表記": 0, "判定保留": 0 };
  const categoryFor = (status) => {
    if (String(status || "").startsWith("存命")) return "存命表記";
    if (String(status || "").startsWith("死亡")) return "死亡表記";
    return "判定保留";
  };
  princesData.forEach((prince) => { counts[categoryFor(prince.status)] += 1; });
  const summary = document.createElement("p");
  summary.className = "guide-status-summary";
  summary.textContent = `人物台帳の状態表記：存命 ${counts["存命表記"]}人／死亡 ${counts["死亡表記"]}人／判定保留 ${counts["判定保留"]}人（第${Math.max(...eventsData.map((event) => event.chapter))}話までの登録情報）`;
  container.appendChild(summary);

  const wrap = document.createElement("div");
  wrap.className = "guide-table-wrap";
  const table = document.createElement("table");
  table.className = "guide-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["王子", "台帳の状態", "集計上の扱い"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  head.appendChild(headRow);
  const body = document.createElement("tbody");
  princesData.forEach((prince) => {
    const row = document.createElement("tr");
    [`第${prince.rank}王子 ${getDisplayName(prince)}`, prince.status || "不明", categoryFor(prince.status)].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.append(head, body);
  wrap.appendChild(table);
  container.appendChild(wrap);
  const caution = document.createElement("p");
  caution.className = "guide-source-note";
  caution.textContent = "これは人物台帳の状態表記の内訳です。王位継承戦への参加資格や人格・肉体の状態を一律に確定する人数ではありません。";
  container.appendChild(caution);

  const personnelTitle = document.createElement("h4");
  personnelTitle.textContent = "作中で人数が示された警護・従事者";
  container.appendChild(personnelTitle);
  const personnelWrap = document.createElement("div");
  personnelWrap.className = "guide-table-wrap";
  const personnelTable = document.createElement("table");
  personnelTable.className = "guide-table";
  const personnelHead = document.createElement("thead");
  const personnelHeadRow = document.createElement("tr");
  ["場面", "確認できた人数", "出典"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    personnelHeadRow.appendChild(th);
  });
  personnelHead.appendChild(personnelHeadRow);
  const personnelBody = document.createElement("tbody");
  [
    ["ワブル陣営の警護", "開始時11名（ハンター4名・王室警備兵7名）→出航約2時間後はクラピカとビルの2名", "第361話"],
    ["モモゼの1012号室", "警護兵6名が残留（第1〜第6王妃から各1名）", "第361話"],
    ["モモゼ側の人員合流後のマラヤーム側", "警護兵・協会員18名＋従事者6名＝24名", "第368話"],
  ].forEach(([scene, count, source]) => {
    const row = document.createElement("tr");
    [scene, count, source].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    personnelBody.appendChild(row);
  });
  personnelTable.append(personnelHead, personnelBody);
  personnelWrap.appendChild(personnelTable);
  container.appendChild(personnelWrap);
  const personnelNote = document.createElement("p");
  personnelNote.className = "guide-source-note";
  personnelNote.textContent = "各行は記載した話数の場面に限る人数です。現在の配置や船全体の人口としては扱いません。";
  container.appendChild(personnelNote);
}

function setupGuideStatus() {
  const button = document.getElementById("revealPrinceStatus");
  const container = document.getElementById("princeStatusContent");
  button.addEventListener("click", () => {
    const revealed = !spoilersRevealed;
    setSpoilersRevealed(revealed);
    button.setAttribute("aria-expanded", String(revealed));
    button.textContent = revealed ? "最新の状況を隠す" : "最新の状況を表示";
    container.hidden = !revealed;
    if (revealed) renderPrinceStatusGuide(container);
    else container.replaceChildren();
  });
}

function renderInitialPersonnelGuide(container) {
  container.replaceChildren();
  const data = initialPersonnelData;
  if (!data?.princes?.length) {
    const message = document.createElement("p");
    message.textContent = "初期配置の復元データを読み込めませんでした。";
    container.appendChild(message);
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "guide-table-wrap";
  const table = document.createElement("table");
  table.className = "guide-table";
  const caption = document.createElement("caption");
  caption.textContent = "出航時の同行人員：王子・王妃本人を除く復元案";
  table.appendChild(caption);
  const head = document.createElement("thead");
  const headings = ["王子", "私設兵（基本枠）", "護衛ハンター", "母側警護兵", "上位王妃の監視兵", "従事者（職種）", "基本枠", "準協会員（枠外）", "初期計"];
  const headRow = document.createElement("tr");
  headings.forEach((label) => { const th = document.createElement("th"); th.textContent = label; headRow.appendChild(th); });
  head.appendChild(headRow);
  const body = document.createElement("tbody");
  function row(values, heading = false) {
    const tr = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = document.createElement(heading && index === 0 ? "th" : "td");
      cell.textContent = String(value);
      if (heading && index === 0) cell.scope = "row";
      tr.appendChild(cell);
    });
    return tr;
  }
  for (const prince of data.princes) {
    body.appendChild(row([
      `第${prince.rank}王子${prince.name}`,
      prince.private_soldiers_excluding_associates,
      prince.association_hunters,
      prince.maternal_guards,
      prince.upper_queen_monitors,
      prince.attendants,
      prince.baseline_total,
      prince.provisional_associates,
      prince.initial_total
    ], true));
  }
  table.append(head, body);
  const foot = document.createElement("tfoot");
  foot.appendChild(row(["合計", data.totals.private_soldiers_excluding_associates,
    data.totals.association_hunters, data.totals.maternal_guards,
    data.totals.upper_queen_monitors, data.totals.attendants,
    data.totals.baseline, data.totals.provisional_associates, data.totals.initial], true));
  table.appendChild(foot);
  wrap.appendChild(table);
  container.appendChild(wrap);

  const firstQueenChildren = new Set(data.princes.filter((prince) => prince.queen_rank === 1).map((prince) => prince.rank));
  const initialFirstQueenMonitors = data.princes.filter((prince) => !firstQueenChildren.has(prince.rank)).length;
  const laterFirstQueenMonitors = personnelSnapshotsData.find((snapshot) => snapshot.chapter === 374)?.princes
    .flatMap((prince) => prince.queen_deployments)
    .find((deployment) => deployment.queen_rank === 1 && deployment.purpose === "下位王子の監視")?.count;
  const note = document.createElement("p");
  note.className = "guide-source-note";
  note.textContent = laterFirstQueenMonitors === undefined
    ? `第1王妃ウンマの監視兵は、初期配置案では下位の${initialFirstQueenMonitors}王子へ各1名、計${initialFirstQueenMonitors}名です。第374話との照合データを読み込めませんでした。`
    : `第1王妃ウンマの監視兵は、初期配置案では下位の${initialFirstQueenMonitors}王子へ各1名、計${initialFirstQueenMonitors}名です。ワブル側の1名の死亡、ヴォルフの死亡（第373話）、モモゼ側の1名の拘束（第368話）を任務から外れた3名と置くと、${initialFirstQueenMonitors}−1−1−1＝${initialFirstQueenMonitors - 3}名となり、第374話の${laterFirstQueenMonitors}名と一致します。死亡2名と拘束1名で説明する復元案です。原図には減少理由の明記がなく、ヴォルフの初期監視先は未確認です。他の王妃は同じ減算で原図と一致しないため、図の全欄を同じ稼働人数の基準とは断定していません。第1・第4王子欄の同じ人数は一度だけ数え、王子の私設兵は加えません。`;
  container.appendChild(note);
}

function renderPersonnelSnapshot(container) {
  container.replaceChildren();
  const snapshot = personnelSnapshotsData.find((entry) => entry.chapter === 374);
  if (!snapshot) {
    const missing = document.createElement("p");
    missing.className = "guide-source-note";
    missing.textContent = "第374話の人員配置データを読み込めませんでした。";
    container.appendChild(missing);
    return;
  }

  const privateNote = document.createElement("p");
  privateNote.className = "guide-source-note";
  privateNote.textContent = "私設兵の括弧内にある準協会員は内数です。王妃所属兵の監視先は下位王妃の王子であり、この行の王子を監視している人数ではありません。同じ王妃の監視兵は複数の子の欄に繰り返し記されています。";
  container.appendChild(privateNote);

  const tableWrap = document.createElement("div");
  tableWrap.className = "guide-table-wrap";
  const table = document.createElement("table");
  table.className = "guide-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["王子", "私設兵", "母の所属兵（原図の記載）", "ハンター協会員", "従事者"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);
  const body = document.createElement("tbody");
  snapshot.princes.forEach((entry) => {
    const prince = princesData.find((candidate) => candidate.rank === entry.rank);
    const row = document.createElement("tr");
    const deploymentText = entry.queen_deployments.length
      ? entry.queen_deployments.map((deployment) => `第${deployment.queen_rank}王妃 ${deployment.count}名（${deployment.purpose}）`).join("／")
      : "—";
    const privateText = entry.private_soldiers
      ? `${entry.private_soldiers}名${entry.provisional_associates ? `（うち準協会員${entry.provisional_associates}名）` : ""}`
      : "—";
    const associationText = entry.association_hunters ? `${entry.association_hunters}名` : "—";
    const attendantsText = entry.attendants ? `${entry.attendants}名` : "—";
    const cells = [
      `第${entry.rank}王子${prince ? getDisplayName(prince) : ""}${entry.roster_state === "transferred" ? "（死亡・人員移動前の記載）" : ""}`,
      privateText,
      deploymentText,
      associationText,
      attendantsText
    ];
    cells.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.append(head, body);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  const transferNote = document.createElement("p");
  transferNote.className = "guide-source-note";
  transferNote.textContent = "第12王子欄には第13王子への人員移動の注記があります。元の担当先と移動先を区別し、両欄の協会員5名・従事者3名という同じ数字だけで、同一人員の重複記載とは判定しません。第368話では合流後の警護兵・協会員18名と従事者6名が確認できます。";
  container.appendChild(transferNote);

  const queenTitle = document.createElement("h4");
  queenTitle.textContent = "王妃所属兵：第374話の記載人数（重複を除く）";
  container.appendChild(queenTitle);
  const deploymentsByQueen = new Map();
  const transferredRosterByRank = new Map(snapshot.princes
    .filter((entry) => entry.roster_state === "transferred" && entry.transfer_to_rank)
    .map((entry) => [entry.rank, entry.transfer_to_rank]));
  snapshot.princes.forEach((entry) => entry.queen_deployments.forEach((deployment) => {
    const placements = deploymentsByQueen.get(deployment.queen_rank) || [];
    if (deployment.purpose === "王室警備兵" || !placements.some((item) => item.purpose === deployment.purpose)) {
      placements.push({ princeRank: entry.rank, count: deployment.count, purpose: deployment.purpose });
    }
    deploymentsByQueen.set(deployment.queen_rank, placements);
  }));
  const queenWrap = document.createElement("div");
  queenWrap.className = "guide-table-wrap";
  const queenTable = document.createElement("table");
  queenTable.className = "guide-table";
  const queenHead = document.createElement("thead");
  const queenHeader = document.createElement("tr");
  ["王妃", "図中の所属兵合計", "任務・配置の内訳"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    queenHeader.appendChild(th);
  });
  queenHead.appendChild(queenHeader);
  const queenBody = document.createElement("tbody");
  charactersData.filter((character) => character.type === "queen").sort((a, b) => a.rank - b.rank).forEach((queen) => {
    const placements = deploymentsByQueen.get(queen.rank) || [];
    const total = placements.reduce((sum, item) => sum + item.count, 0);
    const detail = placements.length
      ? placements.map((item) => {
        if (item.purpose === "下位王子の監視") return `下位王子の監視 ${item.count}名（同母の王子間で共通の記載）`;
        const movedTo = transferredRosterByRank.get(item.princeRank);
        return movedTo
          ? `第${movedTo}王子へ${item.count}名（第${item.princeRank}王子から移動・${item.purpose}）`
          : `第${item.princeRank}王子へ${item.count}名（${item.purpose}）`;
      }).join("／")
      : "図に配置人数の記載なし";
    const row = document.createElement("tr");
    [`第${queen.rank}王妃${getDisplayName(queen)}`, placements.length ? `${total}名` : "図に人数記載なし", detail].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    queenBody.appendChild(row);
  });
  queenTable.append(queenHead, queenBody);
  queenWrap.appendChild(queenTable);
  container.appendChild(queenWrap);

  const queenNote = document.createElement("p");
  queenNote.className = "guide-source-note";
  queenNote.textContent = "同じ王妃の監視兵を各王子の欄から重複して足さず、王子付きの王室警備兵を加えています。この図に載らない兵まで含む総兵力とは限りません。第12王子から第13王子へ移った人員も一度だけ数えています。";
  container.appendChild(queenNote);

  const chart = document.createElement("img");
  chart.className = "zoomable-image guide-source-image guide-personnel-chart";
  chart.loading = "lazy";
  chart.decoding = "async";
  chart.src = "images/guide/personnel-deployment-ch374.webp";
  chart.alt = "第374話の各王子陣営における私設兵・王妃所属兵・ハンター協会員・従事者の配置図";
  chart.title = "第374話より：各陣営の兵力・配置図";
  chart.tabIndex = 0;
  chart.setAttribute("role", "button");
  chart.setAttribute("aria-label", "第374話の人員配置図を拡大");
  const figure = document.createElement("figure");
  figure.className = "guide-panel-quote guide-panel-quote-wide";
  const caption = document.createElement("figcaption");
  caption.textContent = "原作コマ：第374話より、各陣営の人員配置図。クリックで拡大できます。";
  figure.append(chart, caption);
  container.appendChild(figure);
}

function setupPersonnelSnapshotGuide() {
  const button = document.getElementById("revealPersonnelSnapshot");
  const container = document.getElementById("personnelSnapshotContent");
  if (!button || !container) return;
  button.addEventListener("click", () => {
    const revealed = !spoilersRevealed;
    setSpoilersRevealed(revealed);
    button.setAttribute("aria-expanded", String(revealed));
    button.textContent = revealed ? "第374話の配置を隠す" : "第374話の配置を見る";
    container.hidden = !revealed;
    if (revealed) renderPersonnelSnapshot(container);
    else container.replaceChildren();
  });
}

function renderOpenQuestions(container, category = "all") {
  container.replaceChildren();
  const filter = document.createElement("label");
  filter.className = "question-filter";
  filter.textContent = "分類 ";
  const select = document.createElement("select");
  const categories = ["all", ...new Set(openQuestionsData.map((question) => question.category))];
  categories.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "all" ? "すべて" : value;
    select.appendChild(option);
  });
  select.value = category;
  select.addEventListener("change", () => renderOpenQuestions(container, select.value));
  filter.appendChild(select);
  container.appendChild(filter);
  const storyHeading = document.createElement("h4");
  storyHeading.className = "question-section-heading";
  storyHeading.textContent = "作品内の問い（現在の解決状況は登録・照合範囲に限る）";
  container.appendChild(storyHeading);

  openQuestionsData.filter((question) => question.status === "open" && (category === "all" || question.category === category))
    .forEach((question) => {
      const card = document.createElement("article");
      card.className = "question-card";
      const heading = document.createElement("h4");
      heading.textContent = question.title;
      const meta = document.createElement("p");
      meta.className = "question-meta";
      meta.textContent = `${question.category}・第${question.last_checked_chapter}話時点で未解決`;
      meta.title = "登録した範囲での判定です。原作の全件再照合は完了していません。";
      const known = document.createElement("p");
      const containsUnverified = question.related_event_ids.some(id => eventsData.find(e => e.id === id)?.verification_status !== "review_recorded");
      known.textContent = `分かっていること${containsUnverified ? "（一部再照合待ち）" : ""}：${question.known}`;
      if (containsUnverified) known.title = "関連する出来事に、原作との再照合がまだのものを含みます。";
      const unknown = document.createElement("p");
      unknown.textContent = `まだ分からないこと：${question.unknown}`;
      const links = document.createElement("div");
      links.className = "question-event-links";
      // 同じ話の出来事が複数あるときは、同じ文言のリンクが並ばないよう出来事の冒頭を添える。
      const relatedEvents = [...new Set(question.related_event_ids)]
        .map((id) => eventsData.find((candidate) => candidate.id === id)).filter(Boolean);
      const chapterCounts = relatedEvents.reduce((counts, event) => counts.set(event.chapter, (counts.get(event.chapter) || 0) + 1), new Map());
      relatedEvents.forEach((event) => {
        const link = document.createElement("button");
        link.type = "button";
        const summaryText = getEventHeadline(event);
        link.textContent = chapterCounts.get(event.chapter) > 1
          ? `第${event.chapter}話：${summaryText.length > 18 ? `${summaryText.slice(0, 18)}…` : summaryText}`
          : `第${event.chapter}話の出来事`;
        link.title = `場面ID ${event.id}`;
        link.addEventListener("click", () => showDetailModal(event.id, "event", event));
        links.appendChild(link);
      });
      const essayLink = document.createElement("a");
      essayLink.href = `theories/${encodeURIComponent(question.id)}/`;
      essayLink.textContent = "根拠と考察を読む →";
      card.append(heading, meta, known, unknown, links, essayLink);
      container.appendChild(card);
    });
  if (category === "all") {
    // 編集上の確認課題は読者向けの問いと分け、折りたたみにまとめる。
    const editorial = document.createElement("details");
    editorial.className = "editorial-status question-editorial-group";
    const editorialHeading = document.createElement("summary");
    editorialHeading.className = "question-section-heading";
    editorialHeading.textContent = "編集状況：日時・記録の確認課題（作品内の謎とは別）";
    editorial.appendChild(editorialHeading);
    container.appendChild(editorial);
    eventsData.filter(event => event.editorial_questions?.length).forEach(event => {
      const card = document.createElement("article");
      card.className = "question-card question-editorial";
      const link = document.createElement("button");
      link.type = "button";
      link.textContent = `第${event.chapter}話の出来事`;
      link.title = `場面ID ${event.id}`;
      link.addEventListener("click", () => showDetailModal(event.id, "event", event));
      const list = document.createElement("ul");
      event.editorial_questions.forEach(text => { const item = document.createElement("li"); item.textContent = text; list.appendChild(item); });
      card.append(link, list);
      editorial.appendChild(card);
    });
  }
}

function setupOpenQuestions() {
  const button = document.getElementById("revealQuestions");
  const container = document.getElementById("questionDirectory");
  button.addEventListener("click", () => {
    const revealed = !spoilersRevealed;
    setSpoilersRevealed(revealed);
    button.setAttribute("aria-expanded", String(revealed));
    button.textContent = revealed ? "未解決事項を隠す" : "第420話までのネタバレを表示";
    container.hidden = !revealed;
    if (revealed) renderOpenQuestions(container);
    else container.replaceChildren();
  });
}

function activatePrimaryView(view, updateHash = false) {
  const requestedView = view === "places" ? "timeline" : view;
  const validView = ["characters", "timeline", "guide"].includes(requestedView) ? requestedView : "characters";
  document.querySelectorAll("[data-primary-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.primaryPanel !== validView;
  });
  document.querySelectorAll("[data-primary-view]").forEach((link) => {
    const active = link.dataset.primaryView === validView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (updateHash || view === "places") history.replaceState(null, "", `#${validView}`);
  updateViewPermalink();
  window.scrollTo({ top: 0 });
}

function setupPrimaryNavigation() {
  document.querySelectorAll("[data-primary-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activatePrimaryView(link.dataset.primaryView, true);
    });
  });
  window.addEventListener("hashchange", () => activatePrimaryView(location.hash.slice(1)));
  activatePrimaryView(location.hash.slice(1) || "characters");
}

// ===== 初期化 =====

// データ描画前に走るブラウザのフラグメントスクロールは、描画後にレイアウトが
// 大きく伸びるとズレるため、描画完了後に改めてスクロールし直す
function scrollToCurrentHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (target) target.scrollIntoView();
}

function getNenKnowledgeLabel(character, compact = false) {
  return CharacterFacts.nenKnowledgeLabel(character, compact);
}

function isMajorCharacter(character) {
  // 閲覧の入口としての選定。作中の重要度を確定する分類ではない。
  return ["prince", "queen", "king", "phantom_troupe"].includes(character.type)
    || ["HA-001", "HA-002", "HA-003", "HA-004", "HA-005", "HA-006", "P12-H01", "EI-IT01", "BYD-001", "BYD-002", "BYD-003"].includes(character.id);
}

function getEventVerificationLabel(event) {
  if (event.local_created) return event.is_estimate ? "自分で追加・内容は推測" : "自分で追加・未照合";
  return ({ review_recorded: "原作確認記録あり", unverified: "原作再照合待ち", hypothesis: "内容は推測" })[event.verification_status] || "原作再照合待ち";
}

function getEventCharacterLabels(event) {
  const labels = {present: "その場に登場", body: "遺体", mentioned: "話題・紹介のみ", remote: "遠隔・映像", unknown: "所在区分未判定"};
  return (event.characters || []).map(id => `${formatRoyalName(id)}（${labels[event.character_presence?.[id] || "unknown"]}）`);
}

// 読者向けの関係人物表示：名前を主にし、注記は読み方が変わる区分（遺体・話題のみ・遠隔）だけに付ける。
// 「その場に登場」と「所在区分未判定」は編集上の区分なので表示しない（区分の一覧は getEventCharacterLabels）。
function getEventCharacterDisplayLabels(event) {
  const notes = {body: "遺体", mentioned: "話題のみ", remote: "遠隔"};
  return (event.characters || []).map((id) => {
    const note = notes[event.character_presence?.[id]];
    return note ? `${formatRoyalName(id)}（${note}）` : formatRoyalName(id);
  });
}

function getLocationReviewLabel(event) {
  return ({ recorded: "場所の記録あり", unverified: "場所未確認（原作で不明とは未確定）",
    original_unknown: "原作で場所不明", not_applicable: "場所を設定する対象ではない" })[event.location_status]
    || (event.room || event.location ? "場所の記録あり" : "場所未確認");
}

function makeEventReviewRibbon(event, placement = getTimelineTimePlacement(event), includeLocator = true) {
  // 一覧のカードでは既定値（原作確認記録あり・仮時刻・日付の確度など）を出さず、例外だけを示す。
  // 既定の意味は出来事一覧の上の凡例で説明し、詳細画面（includeLocator）では従来どおりすべて表示する。
  if (!includeLocator) return makeCompactEventReviewRibbon(event);
  const ribbon = document.createElement("div");
  ribbon.className = "event-review-ribbon";
  const content = document.createElement("span");
  content.className = `review-badge review-${event.verification_status || "unverified"}`;
  content.textContent = getEventVerificationLabel(event);
  ribbon.appendChild(content);
  const clock = document.createElement("span");
  clock.className = `review-badge clock-${placement?.estimated ? "provisional" : "original"}`;
  clock.textContent = placement?.estimated ? "仮時刻（順序用）" : placement ? "原作の時刻表記・経過表示" : "時刻未登録";
  ribbon.appendChild(clock);
  const date = getDateCertaintyLabel(event);
  if (date) { const badge = document.createElement("span"); badge.className = "review-badge"; badge.textContent = date; ribbon.appendChild(badge); }
  const source = document.createElement("span");
  source.className = "source-locator-label";
  const pages = event.source_locator?.pages;
  source.textContent = `第${event.chapter}話／${pages?.length ? `${pages.join("・")}ページ` : "ページ未照合"}／場面 ${event.id}`;
  if (includeLocator) ribbon.appendChild(source);
  return ribbon;
}

// 管理用の詳しい注記は、読者向け本文から分けてこの折りたたみにまとめる。
// 能力欄の編集上の注記（nen_ability_editorial）。本文（nen_ability）には混ぜず、編集状況の折りたたみに出す。
function getNenAbilityEditorialLines(character) {
  return CharacterFacts.nenAbilityEditorialLines(character);
}

function makeEditorialStatusDetails(lines) {
  const details = document.createElement("details");
  details.className = "editorial-status";
  const summary = document.createElement("summary");
  summary.textContent = "編集状況";
  const list = document.createElement("ul");
  lines.filter(Boolean).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  });
  details.append(summary, list);
  return details;
}

function makeCompactEventReviewRibbon(event) {
  const ribbon = document.createElement("div");
  ribbon.className = "event-review-ribbon event-review-ribbon-compact";
  const add = (text, className, title) => {
    const badge = document.createElement("span");
    badge.className = `review-badge ${className}`;
    badge.textContent = text;
    if (title) badge.title = title;
    ribbon.appendChild(badge);
  };
  if (event.local_created) add(event.is_estimate ? "自分で追加・内容は推測" : "自分で追加", "review-local", "このPCで追加した出来事です。公開データではありません。");
  else if (event.is_estimate || event.verification_status === "hypothesis") {
    // 「内容は推測」と「推測」を1つにまとめる。
    add("内容は推測", "review-hypothesis", makeCertaintyBadge({ ...event, is_estimate: true }).title);
  } else if (event.verification_status !== "review_recorded") {
    add("再照合待ち", "review-unverified", "原作との再照合がまだの出来事です。");
  }
  return ribbon;
}

function makeCharacterReviewPanel(person) {
  const panel = document.createElement("section");
  panel.className = "character-review-panel";
  const scopedEvents = getPersonnelEvents();
  const rows = CharacterFacts.claimRows(person, scopedEvents).filter(row => row.event_ids.every(id => scopedEvents.some(event => event.id === id)));
  if (!rows.length) return panel;
  const heading = document.createElement("h4");
  heading.textContent = "出来事の記録から分かること";
  panel.appendChild(heading);
  rows.forEach(row => {
    const paragraph = document.createElement("p");
    paragraph.textContent = row.text;
    panel.appendChild(paragraph);
    row.event_ids.forEach(id => {
      const event = scopedEvents.find(e => e.id === id);
      if (!event) return;
      const link = document.createElement("button");
      link.type = "button";
      link.textContent = `第${event.chapter}話の出来事`;
      link.title = `場面ID ${id}`;
      link.addEventListener("click", () => showDetailModal(id, "event", event));
      panel.appendChild(link);
    });
  });
  return panel;
}

// 出来事の出典・確認状況・編集メモ。読者が最初に読む情報ではないので、閉じた折りたたみ1つにまとめる。
// 共有用のリンクだけは折りたたみの外に置く。
function makeEventSourcePanel(event) {
  const panel = document.createElement("section");
  panel.className = "event-source-panel";
  panel.appendChild(makeRecordPermalink("event", event.id));
  const details = document.createElement("details");
  details.className = "editorial-status event-source-details";
  const summary = document.createElement("summary");
  summary.textContent = "出典・確認状況・編集メモ";
  details.appendChild(summary);
  const addLine = (text, className) => {
    if (!text) return;
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    details.appendChild(p);
  };
  details.appendChild(makeEventReviewRibbon(event));
  const source = sourcesData.find((entry) => entry.id === event.source_id);
  addLine(`出典：${source?.title || "原作再照合待ち"}`);
  if (source?.url && !/^\s*(?:javascript|data):/i.test(source.url)) {
    const link = document.createElement("a"); link.href = source.url; link.textContent = "確認資料・登録索引を開く";
    const p = document.createElement("p"); p.appendChild(link); details.appendChild(p);
  }
  addLine(event.verification_note ? `確認上の留保：${event.verification_note}` : "", "event-verification-note");
  addLine(`内容の確認：${getEventVerificationLabel(event)}`);
  const dateLabel = getDateCertaintyLabel(event);
  addLine(`日付の確度：${dateLabel || "原作記録に基づく日付"}`);
  addLine(`場所の確認：${getLocationReviewLabel(event)}`);
  if (event.time_estimate_basis) {
    const basis = sourcesData.find((entry) => entry.id === event.time_estimate_basis);
    addLine(`仮時刻の根拠：${basis?.title || event.time_estimate_basis}`);
  }
  addLine(event.location_basis ? `場所の根拠：${event.location_basis}` : "");
  const notes = formatPublicDetailText(event.notes);
  if (notes) {
    const heading = document.createElement("p");
    heading.className = "event-editorial-notes-heading";
    heading.textContent = "編集メモ";
    details.appendChild(heading);
    const block = makeReadableBlock(notes);
    block.classList.add("event-editorial-notes");
    details.appendChild(block);
  }
  addLine(`場面ID：${event.id}（台帳内の識別子）。ページ番号や原作コマとの対応が未照合の項目は、索引があっても確認済みにはしていません。`);
  panel.appendChild(details);
  return panel;
}

function renderChapterCoverage() {
  const container = document.getElementById("chapterCoverage");
  container.replaceChildren();
  for (let chapter = 340; chapter <= 420; chapter++) {
    const events = eventsData.filter((event) => event.chapter === chapter);
    const reviewed = events.filter((event) => event.verification_status === "review_recorded").length;
    const row = document.createElement("div");
    row.className = `coverage-row${events.length ? "" : " coverage-missing"}`;
    const chapterLink = document.createElement("a");
    const url = new URL(location.href); url.hash = "timeline";
    [...url.searchParams.keys()].filter((key) => key.startsWith("t_") || ["person", "event"].includes(key)).forEach((key) => url.searchParams.delete(key));
    url.searchParams.set("t_chapter", String(chapter)); url.searchParams.set("t_period", "all");
    chapterLink.href = url.href; chapterLink.textContent = `第${chapter}話`;
    const text = document.createElement("span");
    text.textContent = events.length ? `${events.length}件・${reviewed ? `${reviewed}件に原作確認記録（登録範囲）` : "登録あり・原作再照合待ち"}`
      : UNCOLLECTED_CHAPTERS.has(chapter) ? `未収録（${UNCOLLECTED_CHAPTERS.get(chapter)}）・出来事は0件` : "未収録・入力と確認が必要";
    row.append(chapterLink, text); container.appendChild(row);
  }
}

function refreshSharedSpoilers() {
  const button = document.getElementById("globalSpoilerToggle");
  if (!button) return;
  // 状態をボタンの文言に含め、スマホでも1行に収める（押した時の動作は title、状態文は読み上げ用に残す）。
  button.textContent = spoilersRevealed ? "ネタバレ：表示中" : "ネタバレ：非表示";
  button.title = spoilersRevealed ? "押すとネタバレを隠します" : "押すとネタバレを表示します";
  button.setAttribute("aria-pressed", String(spoilersRevealed));
  document.getElementById("globalSpoilerStatus").textContent = spoilersRevealed ? "全画面でネタバレを表示しています" : "全画面でネタバレを隠しています";
  [["revealPrinceStatus", "princeStatusContent", renderPrinceStatusGuide],
    ["revealPersonnelSnapshot", "personnelSnapshotContent", renderPersonnelSnapshot],
    ["revealQuestions", "questionDirectory", renderOpenQuestions]].forEach(([id, target, render]) => {
    const control = document.getElementById(id), content = document.getElementById(target);
    if (!control || !content) return;
    control.textContent = spoilersRevealed ? "全画面のネタバレを隠す" : "全画面のネタバレを表示";
    control.setAttribute("aria-expanded", String(spoilersRevealed)); content.hidden = !spoilersRevealed;
    if (spoilersRevealed) render(content); else content.replaceChildren();
  });
  const initialPersonnel = document.getElementById("initialPersonnelContent");
  if (initialPersonnel) {
    if (spoilersRevealed) renderInitialPersonnelGuide(initialPersonnel);
    else initialPersonnel.replaceChildren();
  }
  updateGuideSearch();
}

const VIEW_FILTER_CONTROLS = {
  c_search: "characterSearch", c_type: "characterTypeFilter", c_camp: "characterCampFilter", c_prince: "characterPrinceFilter",
  c_when: "characterPeriodFilter", c_queen: "characterQueenFilter",
  t_room: "roomFilter", t_type: "typeFilter", t_person: "participantFilter", t_chapter: "chapterFilter", t_series: "seriesFilter", t_sort: "timelineSortOrder", t_clock: "timeDisplayMode"
};

function updateViewPermalink() {
  if (!viewLinksReady || window.CharacterRoutes?.isActive()) return;
  const url = new URL(location.href);
  Object.entries(VIEW_FILTER_CONTROLS).forEach(([key, id]) => {
    const value = document.getElementById(id)?.value;
    if (value && value !== "all" && !(key === "t_sort" && value === "asc")) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  const state = { c_group: activeCharacterSection, c_tags: [...activeCharacterTags.values()].join(","), c_affiliation: activeCharacterAffiliation,
    c_view: activeCharacterView, t_period: activeTimelinePeriodId, t_view: activeTimelineView,
    t_hypotheses: document.getElementById("hideHypothesisEvents")?.checked ? "hide" : "" };
  Object.entries(state).forEach(([key, value]) => {
    if (value && (key === "t_period" || !["all", "cards", "schedule"].includes(value))) url.searchParams.set(key, value); else url.searchParams.delete(key);
  });
  // 表示中の画面に関係しない条件はURLに残さない（基礎資料に t_period が残らないようにする）。
  const visibleView = document.querySelector("[data-primary-panel]:not([hidden])")?.dataset.primaryPanel;
  [...url.searchParams.keys()].forEach((key) => {
    if ((key.startsWith("t_") && visibleView !== "timeline") || (key.startsWith("c_") && visibleView !== "characters")) url.searchParams.delete(key);
  });
  history.replaceState(history.state, "", url.href);
  document.getElementById("currentViewLink").href = url.href;
}

function makeRecordPermalink(kind, id) {
  if (kind === "character") {
    const person = charactersData.find((entry) => entry.id === id);
    return makeCharacterDetailLink(person, "個別ページ・詳細", "record-permalink");
  }
  const url = new URL(location.href);
  [...url.searchParams.keys()].filter((key) => /^[ct]_/.test(key) || ["person", "event"].includes(key)).forEach((key) => url.searchParams.delete(key));
  url.hash = kind === "event" ? "timeline" : "characters";
  url.searchParams.set(kind === "event" ? "event" : "person", id);
  const link = document.createElement("a"); link.className = "record-permalink"; link.href = url.href;
  link.textContent = kind === "event" ? "この出来事のリンク" : "この人物のリンク";
  return link;
}

function restoreViewFromUrl(url) {
  Object.entries(VIEW_FILTER_CONTROLS).forEach(([key, id]) => {
    const value = url.searchParams.get(key), control = document.getElementById(id);
    if (value !== null && control && (control.tagName !== "SELECT" || [...control.options].some((option) => option.value === value))) control.value = value;
  });
  const group = url.searchParams.get("c_group");
  if (["all", "princes", "queens", "major", "personnel", ...Object.keys(CHARACTER_TYPE_LABELS), "royal"].includes(group)) activeCharacterSection = group;
  activeCharacterAffiliation = url.searchParams.get("c_affiliation"); activeCharacterTags.clear();
  (url.searchParams.get("c_tags") || "").split(",").filter((id) => characterTagDefinitions.has(id)).forEach(toggleCharacterTagFilter);
  const period = url.searchParams.get("t_period");
  if (TIMELINE_PERIODS.some((entry) => entry.id === period)) activeTimelinePeriodId = period;
  const chapter = url.searchParams.get("t_chapter");
  if (chapter && ![...document.getElementById("chapterFilter").options].some((option) => option.value === chapter) && /^\d+$/.test(chapter)) {
    const option = document.createElement("option"); option.value = chapter; option.textContent = `第${chapter}話（未収録）`;
    document.getElementById("chapterFilter").appendChild(option); document.getElementById("chapterFilter").value = chapter;
  }
  document.getElementById("hideHypothesisEvents").checked = url.searchParams.get("t_hypotheses") === "hide";
  if (["schedule", "chapters", "questions"].includes(url.searchParams.get("t_view"))) activateTimelineView(url.searchParams.get("t_view"));
  if (["cards", "table"].includes(url.searchParams.get("c_view"))) setCharacterView(url.searchParams.get("c_view"));
  const person = charactersData.find((entry) => entry.id === url.searchParams.get("person"));
  if (person) {
    activeCharacterSection = "all"; activeCharacterAffiliation = null; activeCharacterTags.clear();
    ["characterTypeFilter", "characterCampFilter", "characterPrinceFilter"].forEach((id) => { document.getElementById(id).value = "all"; });
    document.getElementById("characterSearch").value = person.name;
  }
  document.getElementById("characterSearch").dispatchEvent(new Event("input")); applyFilter();
  const event = eventsData.find((entry) => entry.id === url.searchParams.get("event"));
  if (event) {
    ["roomFilter", "typeFilter", "participantFilter", "seriesFilter"].forEach((id) => { document.getElementById(id).value = "all"; });
    document.getElementById("chapterFilter").value = String(event.chapter); activeTimelinePeriodId = "all"; applyFilter();
    if (spoilersRevealed) showDetailModal(event.id, "event", event);
  }
  if (person && spoilersRevealed) {
    document.querySelector(`.directory-character-card[data-character-id="${person.id}"] .directory-character-details`)?.setAttribute("open", "");
  }
}

function setupReadingPreferences() {
  // 「本文へ移動」：画面の切り替えに使う URL のハッシュ（#characters など）を変えずに本文へフォーカスを移す。
  document.querySelector(".skip-link")?.addEventListener("click", (event) => {
    const main = document.getElementById("main-content");
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
  });
  document.getElementById("globalSpoilerToggle").addEventListener("click", () => setSpoilersRevealed(!spoilersRevealed));
  document.querySelectorAll("[data-reveal-global]").forEach((button) => button.addEventListener("click", () => setSpoilersRevealed(true)));
  refreshSharedSpoilers(); renderChapterCoverage(); restoreViewFromUrl(initialViewUrl);
  viewLinksReady = true; updateViewPermalink();
}

function makeCharacterDetailLink(person, label, className = "character-name-link") {
  const link = document.createElement("a");
  link.href = new URL(`characters/${encodeURIComponent(person.id)}/`, siteRootUrl).href;
  link.className = className; link.dataset.characterLink = person.id; link.textContent = label;
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showDetailModal(person.id, person.type === "prince" ? "prince" : "bodyguard");
  });
  return link;
}

// メモ・編集機能を出さない場合（一般公開時）は、編集用の常駐ブロックを最下部へ移し、出来事の追加ボタンを隠す。
function applyPublicSiteLayout() {
  const isPublic = !memoEditorEnabled();
  document.body.classList.toggle("public-site", isPublic);
  if (!isPublic) return;
  const drafts = document.querySelector(".local-drafts-transfer");
  const main = document.querySelector("main.page-container");
  if (drafts && main) main.appendChild(drafts);
  const addButton = document.getElementById("addTimelineEvent");
  if (addButton) addButton.hidden = true;
}

function setupTimelineFilterToggle() {
  const button = document.getElementById("timelineFilterToggle");
  const section = document.getElementById("timeline");
  if (!button || !section) return;
  button.addEventListener("click", () => {
    const open = !section.classList.contains("filters-open");
    section.classList.toggle("filters-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "絞り込みを閉じる" : "絞り込みを開く";
  });
}

function setupCharacterFilterToggle() {
  const button = document.getElementById("characterFilterToggle");
  const catalog = document.querySelector(".character-tag-catalog");
  if (!button || !catalog) return;
  button.addEventListener("click", () => {
    const open = !catalog.classList.contains("filters-open");
    catalog.classList.toggle("filters-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "絞り込みを閉じる" : "絞り込みを開く";
  });
}

function setModalBackgroundInert(inert) {
  document.querySelectorAll("body > header, body > main, #backToTop").forEach((element) => { element.inert = inert; });
}

async function init() {
  try {
    const [characters, characterTags, characterImages, countOnlyCharacters, events, openQuestions, spiritBeasts, factions, mafia, allianceData, personnelSnapshots, initialPersonnel, personnelRoster, sources] = await Promise.all([
      loadJson(DATA.characters),
      loadJson(DATA.characterTags),
      loadJson(DATA.characterImages),
      loadJson(DATA.countOnlyCharacters),
      loadJson(DATA.events),
      loadJson(DATA.openQuestions),
      loadJson(DATA.spiritBeasts),
      loadJson(DATA.factions),
      loadJson(DATA.mafia),
      loadJson(DATA.alliances),
      loadJson(DATA.personnelSnapshots),
      loadJson(DATA.initialPersonnel),
      loadJson(DATA.personnelRoster),
      loadJson(DATA.sources)
    ]);

    countOnlyCharacterIds = new Set(countOnlyCharacters.ids);
    sourcesData = sources;
    const imageByCharacterId = new Map(characterImages.map((entry) => [entry.id, entry]));
    charactersData = characters.map((character) => {
      const imageEntry = imageByCharacterId.get(character.id);
      return imageEntry ? { ...character, image: imageEntry.image, image_source_url: imageEntry.source_url, image_source_chapter: imageEntry.source_chapter || null, image_crop: imageEntry.crop || null } : character;
    });
    characterTagDefinitions = new Map(characterTags.definitions.map((tag) => [tag.id, tag]));
    Object.entries(CHARACTER_TYPE_LABELS).forEach(([type, label]) => {
      const id = `type-${type}`;
      characterTagDefinitions.set(id, { id, category: "分類", label });
    });
    Object.entries(CHARACTER_MISSION_TAG_IDS).forEach(([label, id]) => {
      characterTagDefinitions.set(id, { id, category: "任務", label });
    });
    [...new Set(characters.filter((candidate) => candidate.type === "soldier").map((candidate) => candidate.soldier_category).filter(Boolean))]
      .forEach((label) => {
        const id = `soldier-kind-${label}`;
        characterTagDefinitions.set(id, { id, category: "兵種", label });
      });
    characters.filter((candidate) => candidate.type === "prince").forEach((prince) => {
      const id = `affiliation-p${String(prince.rank).padStart(2, "0")}-private`;
      characterTagDefinitions.set(id, { id, category: "所属", label: `第${prince.rank}王子私設兵` });
    });
    characters.filter((candidate) => candidate.type === "queen").forEach((queen) => {
      const id = `affiliation-q${String(queen.rank).padStart(2, "0")}-guards`;
      characterTagDefinitions.set(id, { id, category: "所属", label: `第${queen.rank}王妃所属兵` });
    });
    [...new Set(characters.filter((candidate) => candidate.type === "mafia").map((candidate) => formatAffiliation(candidate)).filter((value) => value && value !== "不明"))]
      .forEach((label) => {
        const id = `mafia-family-${label}`;
        characterTagDefinitions.set(id, { id, category: "所属", label });
      });
    characterTagDefinitions.set("nen-user", { id: "nen-user", category: "念", label: "念能力者" });
    characterTagDefinitions.set("nen-unknown", { id: "nen-unknown", category: "念", label: "念使用未確認" });
    characterTagDefinitions.set("nen-unavailable_confirmed", { id: "nen-unavailable_confirmed", category: "状態", label: "念使用不可の記録あり" });
    characterTagDefinitions.set("nen-not_awakened_confirmed", { id: "nen-not_awakened_confirmed", category: "状態", label: "未覚醒の記録あり" });
    characterTagDefinitions.set("nen-soemono", { id: "nen-soemono", category: "念", label: "ソエモノ" });
    characterTagDefinitions.set("hunter-beyond-kyousen", { id: "hunter-beyond-kyousen", category: "所属", label: "協専" });
    characterTagDefinitions.set("affiliation-royal-guards", { id: "affiliation-royal-guards", category: "所属", label: "王室警備兵" });
    characters.filter((candidate) => candidate.type === "prince").forEach((prince) => {
      const roomNumber = String(1000 + prince.rank);
      characterTagDefinitions.set(`initial-room-${roomNumber}`, { id: `initial-room-${roomNumber}`, category: "初期配置", label: `${roomNumber}号室` });
    });
    characterTagDefinitions.set("relation-blood", { id: "relation-blood", category: "血縁", label: "血縁" });
    characterTagDefinitions.set("relation-blood-reported", { id: "relation-blood-reported", category: "血縁", label: "血縁（手紙）" });
    characterTagDefinitions.set("relation-blood-public", { id: "relation-blood-public", category: "血縁", label: "母（公的）" });
    characterTagDefinitions.set("relation-blood-suggested", { id: "relation-blood-suggested", category: "血縁", label: "血縁（示唆・未確定）" });
    characterTagDefinitions.set("nen-class-1", { id: "nen-class-1", category: "念講習会", label: "第1回参加者" });
    characterTagDefinitions.set("nen-class-2", { id: "nen-class-2", category: "念講習会", label: "第2回参加者" });
    characterTagDefinitions.set("status-deceased", { id: "status-deceased", category: "状態", label: "死亡" });
    characterTagDefinitions.set("status-killer", { id: "status-killer", category: "状態", label: "殺害（加害者として明示された記録あり）" });
    characters.filter((candidate) => candidate.type === "queen" || candidate.id === "BYD-001").forEach((parent) => {
      if (parent.id === "Q01") return;
      const id = `blood-parent-${parent.id.toLowerCase()}`;
      const name = getDisplayName(parent);
      const label = parent.type === "queen" ? `第${parent.rank}王妃${name}` : name;
      characterTagDefinitions.set(id, { id, category: "血縁", label });
    });
    characters.filter((candidate) => candidate.reported_biological_mother_id).forEach((candidate) => {
      const parent = characters.find((item) => item.id === candidate.reported_biological_mother_id);
      if (!parent) return;
      const id = `blood-reported-${parent.id.toLowerCase()}`;
      characterTagDefinitions.set(id, { id, category: "血縁", label: `第${parent.rank}王妃${getDisplayName(parent)}（${candidate.reported_biological_mother_chapter}話の手紙に実母と記載・未検証）` });
    });
    characters.filter((candidate) => candidate.public_mother_id).forEach((candidate) => {
      const parent = characters.find((item) => item.id === candidate.public_mother_id);
      if (!parent) return;
      const id = `blood-public-${parent.id.toLowerCase()}`;
      characterTagDefinitions.set(id, { id, category: "血縁", label: `第${parent.rank}王妃${getDisplayName(parent)}（公的な母）` });
    });
    characterTagDefinitions.set("blood-suggested-p03-swu-001", {
      id: "blood-suggested-p03-swu-001", category: "血縁", label: "チョウライとオニオールの未確定な血縁"
    });
    characters.filter((candidate) => candidate.known_half_sibling_ids?.length || candidate.known_half_sibling_id)
      .flatMap((candidate) => candidate.known_half_sibling_ids || [candidate.known_half_sibling_id])
      .forEach((id) => {
        const relative = characters.find((candidate) => candidate.id === id);
        if (relative) characterTagDefinitions.set(`blood-half-sibling-${id.toLowerCase()}`, {
          id: `blood-half-sibling-${id.toLowerCase()}`, category: "血縁", label: `${relative.name.split("＝")[0]}（異母兄弟）`
        });
      });
    characters.filter((candidate) => candidate.known_sibling_ids?.length)
      .flatMap((candidate) => candidate.known_sibling_ids)
      .forEach((id) => {
        const relative = characters.find((candidate) => candidate.id === id);
        if (relative) characterTagDefinitions.set(`blood-sibling-${id.toLowerCase()}`, {
          id: `blood-sibling-${id.toLowerCase()}`, category: "血縁", label: `${relative.name.split("＝")[0]}（兄弟・母未確認）`
        });
      });
    characters.filter((candidate) => candidate.type === "prince").forEach((prince) => {
      const id = `target-${prince.id.toLowerCase()}`;
      characterTagDefinitions.set(id, { id, category: "対象", label: `第${prince.rank}王子${getDisplayName(prince)}` });
      const guardId = `guard-${prince.id.toLowerCase()}`;
      characterTagDefinitions.set(guardId, { id: guardId, category: "護衛", label: `第${prince.rank}王子${getDisplayName(prince)}` });
    });
    characterTagsById = new Map(characterTags.assignments.map((entry) => [entry.character_id, entry.tag_ids]));
    spiritBeastsData = spiritBeasts;
    factionsData = factions;
    alliancesData = allianceData.alliances;
    mafiaData = mafia;
    personnelSnapshotsData = personnelSnapshots.snapshots || [];
    initialPersonnelData = initialPersonnel;
    personnelRosterData = personnelRoster;
    try {
      spoilersRevealed = localStorage.getItem(SPOILER_VISIBILITY_KEY) === "true";
    } catch (error) {
      console.warn("ネタバレ表示設定を読み込めませんでした", error);
    }
    await loadLocalDrafts();
    applyPublicSiteLayout();
    appendCreatedEvents(events);
    applyLocalDrafts(charactersData, (character) => character.type === "prince" ? "prince" : "bodyguard");
    applyLocalDrafts(events, () => "event");
    applyLocalDrafts(spiritBeastsData, () => "spiritBeast");
    confirmedKillsById = new Map();
    charactersData.forEach((victim) => (victim.status_log || []).forEach((record) => {
      if (!record.killer || !/^死亡/.test(record.status || "")) return;
      const victims = confirmedKillsById.get(record.killer) || [];
      victims.push({ id: victim.id, chapter: record.chapter });
      confirmedKillsById.set(record.killer, victims);
    }));

    princesData = charactersData.filter((c) => c.type === "prince").sort((a, b) => a.rank - b.rank);
    bodyguardsData = charactersData.filter((c) =>
      ["hunter", "soldier", "attendant"].includes(c.type)
      && (c.position_code || (c.type === "hunter" && c.mission === "護衛" && c.camp))
      && isDirectoryCharacter(c)
    );
    eventsData = [...events].sort((a, b) => sortKey(a) - sortKey(b));
    openQuestionsData = openQuestions;
    inferredTimePlacements = buildInferredTimePlacements(eventsData);
    if (pendingDraftMigration) await saveLocalDrafts();

    buildPrinceMap(princesData);
    buildCharMap(charactersData);

    renderCharacterDirectory(charactersData.filter(isDirectoryCharacter));
    setupCharacterDirectory();
    setupCharacterFilterToggle();
    setupTimelineFilterToggle();
    setupGuideStatus();
    setupPersonnelSnapshotGuide();
    setupGuideMemos();
    setupGuideNavigation();
    setupOpenQuestions();
    setupDetailModal();
    setupEventCreation();
    setupImageLightbox();
    setupDraftTransfer();
    setupTimelineTabs();
    setupFilters();
    setupBackToTop();
    setupPrimaryNavigation();
    setupReadingPreferences();
    window.CharacterRoutes?.setup({rootUrl:siteRootUrl.href,
      getPerson:(id)=>charactersData.find((person)=>person.id===id),
      open:(id)=>{ const person=charactersData.find((candidate)=>candidate.id===id); showDetailModal(id,person.type==="prince"?"prince":"bodyguard"); },
      close:()=>closeDetailModal(true)});
    if (initialViewUrl.searchParams.get("detail") === "1") {
      const person = charactersData.find((candidate) => candidate.id === initialViewUrl.searchParams.get("person"));
      if (person) showDetailModal(person.id, person.type === "prince" ? "prince" : "bodyguard");
    }
    const linkedEvent = eventsData.find(event => event.id === initialViewUrl.searchParams.get("event"));
    if (linkedEvent) showDetailModal(linkedEvent.id, "event", linkedEvent);

    try {
      const pending = JSON.parse(sessionStorage.getItem(REOPEN_DETAIL_KEY) || "null");
      sessionStorage.removeItem(REOPEN_DETAIL_KEY);
      if (pending?.id && pending?.category) {
        if (pending.view === "inline") {
          const key = `${pending.category}:${pending.id}`;
          const details = [...document.querySelectorAll("[data-local-record-key]")]
            .find((item) => item.dataset.localRecordKey === key);
          if (details) {
            details.open = true;
            details.scrollIntoView({ block: "center" });
          }
        } else {
          const event = pending.category === "event" ? eventsData.find((item) => item.id === pending.id) : null;
          window.scrollTo(0, Number(pending.scrollY) || 0);
          showDetailModal(pending.id, pending.category, event);
        }
      }
    } catch (error) {
      console.warn("詳細画面の復元に失敗しました", error);
    }

    if (!["characters", "places", "timeline", "guide"].includes(location.hash.slice(1))) {
      scrollToCurrentHash();
    }
  } catch (err) {
    console.error("データの読み込みに失敗しました", err);
  }
}

init();
