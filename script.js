const DATA = {
  characters: "data/characters.json",
  characterImages: "data/character_images.json",
  events: "data/events.json",
  spiritBeasts: "data/spirit_beasts.json",
  factions: "data/factions.json",
  mafia: "data/mafia.json"
};

let charactersData = [];
let princesData = [];
let bodyguardsData = [];
let eventsData = [];
let spiritBeastsData = [];
let factionsData = [];
let mafiaData = [];
let filteredEventsData = [];
let activeTimelineView = "schedule";
let timelineVisibleCount = 30;
let activeRoomAreaId = "room-1001";
let activePlaceGroupId = "layer-1";
let activeTimelinePeriodId = "day-1";
let activeCharacterAffiliation = null;
let activeCharacterSection = "royal";
let activeCharacterSubgroup = null;
let activeCharacterView = "cards";
let currentCharacterResults = [];
let modalReturnFocus = null;
let PRINCE_MAP = {}; // 王子の正式名 → { rank, short }
let CHAR_MAP = {}; // id → character
const BASIC_CHARACTER_IDS = new Set(["HA-001", "HA-005", "BYD-002", "BYD-003"]);

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
  return token === "ナスビー＝ホイコーロ" ? token : String(token).replace(/＝ホイコーロ/g, "");
}

function getDisplayName(character) {
  if (!character) return "";
  return character.id === "KNG-001" ? character.name : character.name.replace(/＝ホイコーロ/g, "");
}

function formatDisplayText(value) {
  if (value == null) return value;
  return String(value)
    .replace(/ch(\d+)/gi, "$1話")
    .replace(/[（(]P\d{2}-[A-Z]\d+[）)]/g, "")
    .replace(/ketsu_mochi（血盟主）/g, "ケツモチ")
    .replace(/幻影旅団（スパイダー）/g, "幻影旅団")
    .replace(/＝ホイコーロ/g, "");
}

function formatRoomLabel(value) {
  if (value == null || value === "") return null;
  const text = String(value).replace(/\s+/g, "");
  const room = text.match(/(10\d{2})号室?$/)?.[1] || (/^10\d{2}$/.test(text) ? text : null);
  if (room) return `1層${room}号室`;
  return text.replace(/^第([1-5])層/, "$1層");
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
  let value = formatGroupReference(formatDisplayText(character.affiliation).replace(/陣営$/, ""));
  if (character.soldier_category === "私設兵" && !/私設兵/.test(value)) value += "私設兵";
  if (character.soldier_category === "王妃所属兵" && !/王妃.*兵|所属兵/.test(value)) value += "所属兵";
  return value;
}

function getNenClassLabel(character) {
  const first = (eventsData.find((event) => event.id === "E369-002")?.characters || []).includes(character.id);
  const second = (eventsData.find((event) => event.id === "E411-003")?.characters || []).includes(character.id);
  if (character.id === "P14-H01") return "第一回・第二回念講習会の講師";
  if (first && second) return "第一回・第二回とも参加";
  if (first) return "第一回念講習会に参加";
  if (second) return "第二回念講習会に参加";
  return null;
}

function formatLocationLabel(value) {
  if (!value) return "場所不明";
  return String(value)
    .replace(/第([1-5])層/g, "$1層")
    .replace(/1層\s+(10\d{2}号室)/g, "1層$1")
    .replace(/(^|[^\d])(10\d{2})(?!号室)/g, "$1$2号室");
}

function getCharacterLocationHistory(character) {
  const transitions = [];
  eventsData.forEach((event) => {
    if (!(event.characters || []).includes(character.id)) return;
    const location = formatLocationLabel(getLocationKey(event));
    if (!location || location === "場所不明") return;
    if (transitions.at(-1)?.location === location) return;
    const timing = [
      `${event.chapter}話`,
      event.day != null ? `${event.day}日目` : null,
      getTimeLabel(event)
    ].filter(Boolean).join("・");
    transitions.push({ location, timing });
  });
  return transitions.map(({ location, timing }) => `${timing}：${location}`).join(" → ");
}

function getEventDateCertainty(event) {
  if (event.date_certainty) return event.date_certainty;
  if (Number(event.chapter) >= 411) return "provisional";
  return event.day != null || event.period ? "confirmed" : "unknown";
}

function getDateCertaintyLabel(event) {
  return {
    confirmed: "日付確定",
    estimated: "日付推定",
    provisional: "単行本未収録・暫定",
    unknown: "日付不明"
  }[getEventDateCertainty(event)] || "日付不明";
}

function makeCertaintyBadge(event) {
  const certainty = getEventDateCertainty(event);
  const span = document.createElement("span");
  span.className = `certainty-badge certainty-${certainty}`;
  span.textContent = getDateCertaintyLabel(event);
  return span;
}

function getLatestKnownLocation(character) {
  const matching = eventsData
    .map((event) => ({ event, location: getCharacterEventLocation(event, character.id) }))
    .filter(({ event, location }) => (event.characters || []).includes(character.id) && location)
    .slice().sort((a, b) => {
      const chronology = (event) => {
        event = event.event || event;
        if (event.period === "preboard") return 0;
        if (event.period === "ritual") return 1000;
        if (event.day != null) return 2000 + Number(event.day) * 100000 + (parseTimeString(event.time_start) || 0) * 10 + (Number(event.chapter) || 0);
        return 1500 + (Number(event.chapter) || 0);
      };
      return chronology(a) - chronology(b) || sortKey(a.event) - sortKey(b.event);
    });
  const latestEntry = matching.at(-1);
  const latest = latestEntry?.event;
  if (!latest) {
    const registered = formatRoomLabel(character.room || character.location);
    return registered ? { location: registered, basis: "人物台帳の登録値", certainty: "unknown" } : null;
  }
  return {
    location: formatLocationLabel(latestEntry.location),
    basis: `${latest.chapter}話時点`,
    certainty: getEventDateCertainty(latest)
  };
}

function getCharacterEventLocation(event, characterId) {
  if (event.character_locations && Object.hasOwn(event.character_locations, characterId)) {
    return event.character_locations[characterId] || null;
  }
  const location = getLocationKey(event);
  if (location === "場所不明") return null;
  const remoteOrRetrospective = /電話|通話|連絡|報告|手紙|回想|モノローグ|知らされ|伝え/.test(event.description || "")
    || ["flashback", "reference", "setting"].includes(event.chronology_kind);
  if (remoteOrRetrospective && (event.characters || []).length > 1) return null;
  return location;
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
  soldier: "護衛・兵士",
  attendant: "従事者",
  mafia: "マフィア",
  phantom_troupe: "幻影旅団",
  official: "司法・政府"
};

function makeCharacterTypeBadge(type) {
  const span = document.createElement("span");
  span.className = `character-type-badge character-type-${type}`;
  span.textContent = CHARACTER_TYPE_LABELS[type] || type;
  return span;
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
        btn.disabled = count === 0;
        btn.title = count === 0 ? "選択中の日付には該当イベントがありません" : `${count}件`;
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

function makeAvatar(label, nenType, imageSrc = null) {
  const div = document.createElement("div");
  div.className = "char-avatar";
  if (nenType) {
    div.classList.add(`nen-avatar-${nenType.replace("系", "")}`);
  }
  if (imageSrc) {
    const img = document.createElement("img");
    img.alt = label;
    img.src = imageSrc;
    img.onerror = () => {
      img.remove();
      div.textContent = label;
      if (label.length >= 3) div.style.fontSize = "0.7rem";
    };
    div.appendChild(img);
  } else {
    div.textContent = label;
    if (label.length >= 3) div.style.fontSize = "0.7rem";
  }
  return div;
}

function makeBeastImage(src, alt) {
  if (!src) return null;
  const img = document.createElement("img");
  img.className = "beast-image";
  img.alt = alt || "守護霊獣";
  img.src = src;
  img.onerror = () => img.remove();
  return img;
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
    const avatar = makeAvatar(`第${p.rank}`, p.nen_type, p.image || null);
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

// ===== 守護霊獣一覧 =====

function renderSpiritBeasts(beasts) {
  const grid = document.getElementById("spirit-beast-grid");
  grid.innerHTML = "";
  if (beasts.length === 0) {
    grid.textContent = "該当する守護霊獣が見つかりませんでした。";
    return;
  }
  beasts.forEach((b) => {
    const items = [
      { label: "担当王子", value: formatRoyalName(b.prince) },
      { label: "外見・形態", value: b.appearance || "不明" },
      { label: "能力", value: b.ability || "不明" }
    ];
    const badges = [makeNenBadge(b.nen_type)];
    const beastImage = makeBeastImage(b.image, b.name);
    grid.appendChild(createCard(b.name || `${formatRoyalName(b.prince)}の守護霊獣`, items, badges, () => showDetailModal(b.name, "spiritBeast"), beastImage));
  });
}

function setupBeastNenFilter() {
  const nenFilter = document.getElementById("beastNenFilter");
  nenFilter.addEventListener("change", () => {
    const val = nenFilter.value;
    const filtered = val === "all" ? spiritBeastsData
      : spiritBeastsData.filter((b) => b.nen_type === val);
    renderSpiritBeasts(filtered);
  });
}

// ===== 護衛・ハンター一覧 =====

function createBodyguardCard(g) {
  const outside = isOutsidePlacement(g);
  const items = [
    { label: "分類", value: g.soldier_category || "不明" },
    { label: "配置先", value: g.camp || "不明" },
    { label: "所属", value: g.affiliation || "不明" },
    { label: "念系統", value: g.nen_type || "不明" },
    { label: "能力", value: g.nen_ability || "不明" },
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
  const avatar = makeAvatar(initial, g.nen_type, g.image || null);
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
    [g.nen_type, g.nen_ability].filter(Boolean).join(" / ") || "不明",
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

function getRelatedPrinceIds(character) {
  if (character.type === "prince") return [character.id];
  if (character.type === "queen") return character.children || [];
  if (character.type === "mafia") return character.id === "SWU-001" ? ["P03"] : [];
  // 関係王子は構造化済みの所属・配置だけで判定する。
  // 備考や役割の文章を含めると、「カミーラを拘束した」だけの人物まで
  // カミーラ関係者として誤分類される。呪殺対象も王子側の人物を意味しないため使用しない。
  const text = [character.camp, character.affiliation].filter(Boolean).join(" ");
  const ids = princesData.filter((prince) => {
    const shortName = getDisplayName(prince);
    return text.includes(shortName) || text.includes(`第${prince.rank}王子`) || character.id.startsWith(`${prince.id}-`);
  }).map((prince) => prince.id);
  return [...new Set(ids)];
}

function createCharacterDirectoryCard(character) {
  const card = document.createElement("article");
  card.className = "directory-character-card";

  const top = document.createElement("div");
  top.className = "directory-character-top";
  const avatarLabel = character.type === "prince" ? `第${character.rank}` : character.name.slice(0, 2);
  top.appendChild(makeAvatar(avatarLabel, character.nen_type, character.image || null));

  const identity = document.createElement("div");
  identity.className = "directory-character-identity";
  const heading = document.createElement("h3");
  heading.textContent = character.type === "prince"
    ? `第${character.rank}王子${getDisplayName(character)}`
    : character.type === "queen"
      ? `第${character.rank}王妃${getDisplayName(character)}`
      : getDisplayName(character);
  const badges = document.createElement("div");
  badges.className = "compact-person-badges";
  badges.appendChild(makeCharacterTypeBadge(character.type));
  const assignment = formatAssignment(character);
  const usesAffiliationTag = ["soldier", "mafia"].includes(character.type);
  const tagValue = usesAffiliationTag ? formatAffiliation(character) : assignment;
  const tagFilterValue = usesAffiliationTag ? character.affiliation : character.camp;
  if (tagValue) {
    const clickable = usesAffiliationTag;
    const campBadge = document.createElement(clickable ? "button" : "span");
    if (clickable) campBadge.type = "button";
    campBadge.className = `character-camp-badge${clickable ? " character-filter-tag" : ""}`;
    campBadge.textContent = tagValue;
    if (clickable) {
      campBadge.title = `${tagValue}の人物を表示`;
      campBadge.addEventListener("click", () => {
        activatePrimaryView("characters", true);
        document.getElementById("characterSearch").value = "";
        document.getElementById("characterTypeFilter").value = "all";
        document.getElementById("characterCampFilter").value = "all";
        document.getElementById("characterPrinceFilter").value = "all";
        activeCharacterAffiliation = tagFilterValue;
        document.dispatchEvent(new Event("character-affiliation-filter"));
      });
    }
    badges.appendChild(campBadge);
  }
  identity.append(heading, badges);
  top.appendChild(identity);
  card.appendChild(top);

  const details = document.createElement("details");
  details.className = "compact-person-details directory-character-details";
  const toggle = document.createElement("summary");
  toggle.textContent = "詳細";
  details.appendChild(toggle);

  const latestLocation = getLatestKnownLocation(character);
  const sections = [
    {
      title: "現在の状況",
      rows: [
        { label: "所属", value: formatAffiliation(character) },
        { label: "配置・護衛先", value: assignment },
        { label: "最新確認位置", value: latestLocation ? `${latestLocation.location}（${latestLocation.basis}）` : null },
        { label: "位置の確度", value: latestLocation ? ({ confirmed: "確定", provisional: "暫定", estimated: "推定", unknown: "不明" }[latestLocation.certainty]) : null },
        { label: "任務", value: formatDisplayText(character.mission) },
        { label: "任務対象", value: formatDisplayText(character.target) },
        { label: "状態", value: formatDisplayText(character.status) }
      ]
    },
    {
      title: "人物情報",
      rows: [
        { label: "親", value: getKnownParentIds(character).length ? getRelationshipNames(getKnownParentIds(character)) : null },
        { label: "子供", value: getKnownChildIds(character).length ? getRelationshipNames(getKnownChildIds(character)) : null },
        { label: "役割", value: formatDisplayText(character.role) },
        { label: "念系統", value: character.nen_type },
        { label: "念能力", value: formatDisplayText(character.nen_ability) }
      ]
    },
    {
      title: "履歴・判明情報",
      rows: [
        { label: "所在・移動履歴", value: getCharacterLocationHistory(character) },
        { label: "念講習会", value: getNenClassLabel(character) },
        { label: "備考", value: formatDisplayText(character.notes) },
        { label: "判明情報", value: formatDisplayText(character.spoiler_notes) }
      ]
    }
  ];

  sections.forEach((section) => {
    const rows = section.rows.filter(({ value }) => value || value === 0);
    if (rows.length === 0) return;
    const heading = document.createElement("h4");
    heading.className = "character-detail-section-title";
    heading.textContent = section.title;
    const dl = document.createElement("dl");
    rows.forEach(({ label, value }) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.append(dt, dd);
    });
    details.append(heading, dl);
  });

  if (character.type === "prince") {
    const beast = spiritBeastsData.find((candidate) => candidate.prince.replace(/＝ホイコーロ/g, "") === getDisplayName(character));
    if (beast) {
      const beastSection = document.createElement("section");
      beastSection.className = "directory-spirit-beast";
      const beastImage = makeBeastImage(beast.image, beast.name);
      if (beastImage) beastSection.appendChild(beastImage);
      const beastText = document.createElement("div");
      const beastHeading = document.createElement("h4");
      beastHeading.textContent = `守護霊獣：${beast.name || "名称不明"}`;
      const beastDescription = document.createElement("p");
      beastDescription.textContent = [beast.appearance, beast.ability].filter(Boolean).join("｜") || "詳細不明";
      beastText.append(beastHeading, beastDescription);
      beastSection.appendChild(beastText);
      details.appendChild(beastSection);
    }
  }

  if (character.id === "BYD-001") {
    const note = document.createElement("p");
    note.className = "parentage-note";
    note.textContent = "確認済みの実子はロンギとマカハ。ほかにも10名以上のソエモノと、王族内に実子がいることが判明しているが、全員の氏名は未確定。";
    details.appendChild(note);
  }
  if (character.id === "KNG-001") {
    const note = document.createElement("p");
    note.className = "parentage-note";
    note.textContent = "14王子の公的な父。王族内にビヨンドの実子がいることが示されているため、血縁上の父子関係には未確定要素がある。";
    details.appendChild(note);
  }

  card.appendChild(details);
  return card;
}

function getCharacterTypeGroup(character) {
  if (["king", "queen", "prince"].includes(character.type)) return "royal";
  return character.type;
}

function sortCharacters(a, b) {
  const order = { king: 0, queen: 1, prince: 2, hunter: 3, soldier: 4, attendant: 5, official: 6, mafia: 7, phantom_troupe: 8 };
  const typeDiff = (order[a.type] ?? 99) - (order[b.type] ?? 99);
  if (typeDiff !== 0) return typeDiff;
  if (a.type === "soldier" && b.type === "soldier") {
    const assignmentRank = (character) => {
      const assignment = [character.camp, character.current_assignment, character.room].filter(Boolean).join(" ");
      const prince = princesData.find((candidate) => {
        const name = getDisplayName(candidate);
        return assignment.includes(name) || assignment.includes(`第${candidate.rank}王子`);
      });
      if (prince) return prince.rank;
      const roomNumber = String(character.room || "").match(/10(0[1-9]|1[0-4])/)?.[0];
      return roomNumber ? Number(roomNumber) - 1000 : 99;
    };
    const rankDiff = assignmentRank(a) - assignmentRank(b);
    if (rankDiff !== 0) return rankDiff;
    const soldierPriority = (character) => {
      if (character.mission === "監視") return 90;
      const categoryOrder = { "私設兵": 0, "王室警備兵": 10, "王妃所属兵": 30 };
      return categoryOrder[character.soldier_category] ?? 20;
    };
    const priorityDiff = soldierPriority(a) - soldierPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    const targetRank = (character) => Number(String(character.target || "").match(/第(\d+)王子/)?.[1] || 99);
    const targetDiff = targetRank(a) - targetRank(b);
    if (targetDiff !== 0) return targetDiff;
  }
  if (a.rank != null || b.rank != null) return (a.rank ?? 999) - (b.rank ?? 999);
  return a.name.localeCompare(b.name, "ja");
}

function renderCharacterDirectory(characters) {
  const container = document.getElementById("characterDirectory");
  const summary = document.getElementById("characterResultSummary");
  container.innerHTML = "";
  currentCharacterResults = characters.slice().sort(sortCharacters);
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
  head.innerHTML = "<tr><th>人物</th><th>役割区分</th><th>所属</th><th>配置・護衛先</th><th>任務</th><th>最新確認位置</th></tr>";
  const body = document.createElement("tbody");
  rows.forEach((character) => {
    const latest = getLatestKnownLocation(character);
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
      formatAssignment(character) || "—",
      [formatDisplayText(character.mission), formatDisplayText(character.target)].filter(Boolean).join("：") || "—",
      latest ? `${latest.location}｜${latest.basis}｜${({ confirmed: "確定", provisional: "暫定", estimated: "推定", unknown: "不明" }[latest.certainty])}` : "不明"
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
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
  [["characterViewCards", "cards"], ["characterViewTable", "table"]].forEach(([id, value]) => {
    const button = document.getElementById(id);
    const active = value === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderBasicCharacters() {
  const container = document.getElementById("basicCharacterDirectory");
  container.innerHTML = "";
  charactersData.filter((character) => BASIC_CHARACTER_IDS.has(character.id))
    .sort(sortCharacters)
    .forEach((character) => container.appendChild(createCharacterDirectoryCard(character)));
}

function setupCharacterDirectory() {
  const search = document.getElementById("characterSearch");
  const typeFilter = document.getElementById("characterTypeFilter");
  const campFilter = document.getElementById("characterCampFilter");
  const princeFilter = document.getElementById("characterPrinceFilter");
  const onboardCharacters = charactersData.filter((character) => !BASIC_CHARACTER_IDS.has(character.id));
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
  const subNav = document.getElementById("characterSubNav");
  const topGroups = [
    { id: "royal", label: "王族" },
    { id: "princes", label: "王子陣営" },
    { id: "hunter", label: "ハンター協会" },
    { id: "mafia", label: "マフィア" },
    { id: "phantom_troupe", label: "幻影旅団" },
    { id: "official", label: "司法・政府" },
    { id: "all", label: "全員" }
  ];
  const apply = () => {
    const query = search.value.trim().toLowerCase();
    const type = typeFilter.value;
    const camp = campFilter.value;
    const princeId = princeFilter.value;
    const filtered = onboardCharacters.filter((character) => {
      const typeMatch = type === "all" || getCharacterTypeGroup(character) === type;
      const beast = character.type === "prince"
        ? spiritBeastsData.find((candidate) => candidate.prince.replace(/＝ホイコーロ/g, "") === getDisplayName(character))
        : null;
      const searchable = [
        character.name, character.affiliation, character.camp, character.role,
        character.nen_ability, character.notes, character.mission, character.target, formatAffiliation(character),
        formatAssignment(character), getNenClassLabel(character), beast?.name, beast?.ability
      ].filter(Boolean).join(" ").toLowerCase();
      const campMatch = camp === "all" || character.camp === camp;
      const affiliationMatch = !activeCharacterAffiliation
        || character.affiliation === activeCharacterAffiliation
        || character.affiliation?.startsWith(`${activeCharacterAffiliation}（`);
      const princeMatch = princeId === "all" || getRelatedPrinceIds(character).includes(princeId);
      return typeMatch && campMatch && affiliationMatch && princeMatch && (!query || searchable.includes(query));
    });
    renderCharacterDirectory(filtered);
  };
  const clearAffiliationAndApply = () => {
    activeCharacterAffiliation = null;
    apply();
  };
  search.addEventListener("input", clearAffiliationAndApply);
  typeFilter.addEventListener("change", clearAffiliationAndApply);
  campFilter.addEventListener("change", clearAffiliationAndApply);
  princeFilter.addEventListener("change", clearAffiliationAndApply);
  document.addEventListener("character-affiliation-filter", apply);

  const renderSubgroups = () => {
    subNav.innerHTML = "";
    let groups = [];
    if (activeCharacterSection === "princes") {
      groups = princesData.slice().sort((a, b) => a.rank - b.rank).map((prince) => ({
        id: prince.id,
        label: `第${prince.rank}王子${getDisplayName(prince)}`
      }));
    } else if (activeCharacterSection === "mafia") {
      groups = [
        { id: "mafia-swu", label: "シュウ＝ウ一家", affiliation: "シュウ＝ウ一家" },
        { id: "mafia-eii", label: "エイ＝イ一家", affiliation: "エイ＝イ一家" },
        { id: "mafia-saa", label: "シャ＝ア一家", affiliation: "シャ＝ア一家" }
      ];
    }
    subNav.hidden = groups.length === 0;
    groups.forEach((group, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const active = group.id === activeCharacterSubgroup || (!activeCharacterSubgroup && index === 0);
      if (active) activeCharacterSubgroup = group.id;
      button.className = `character-sub-nav-button${active ? " active" : ""}`;
      button.textContent = group.label;
      button.setAttribute("aria-pressed", String(active));
      button.addEventListener("click", () => {
        activeCharacterSubgroup = group.id;
        subNav.querySelectorAll("button").forEach((candidate) => {
          const selected = candidate === button;
          candidate.classList.toggle("active", selected);
          candidate.setAttribute("aria-pressed", String(selected));
        });
        search.value = "";
        campFilter.value = "all";
        if (group.id.startsWith("P")) {
          activeCharacterAffiliation = null;
          typeFilter.value = "all";
          princeFilter.value = group.id;
        } else {
          princeFilter.value = "all";
          typeFilter.value = "mafia";
          activeCharacterAffiliation = group.affiliation;
        }
        apply();
      });
      subNav.appendChild(button);
    });
    if (groups.length) subNav.querySelector("button")?.click();
  };

  topGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-camp-nav-button${group.id === "royal" ? " active" : ""}`;
    button.textContent = group.label;
    button.setAttribute("aria-pressed", String(group.id === "royal"));
    button.addEventListener("click", () => {
      quickNav.querySelectorAll("button").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      search.value = "";
      activeCharacterAffiliation = null;
      activeCharacterSection = group.id;
      activeCharacterSubgroup = null;
      campFilter.value = "all";
      princeFilter.value = "all";
      typeFilter.value = group.id === "princes" ? "all" : group.id;
      renderSubgroups();
      apply();
    });
    quickNav.appendChild(button);
  });
  document.getElementById("characterViewCards").addEventListener("click", () => setCharacterView("cards"));
  document.getElementById("characterViewTable").addEventListener("click", () => setCharacterView("table"));
  document.getElementById("assignmentOnly").addEventListener("change", () => renderCharacterAssignmentTable(currentCharacterResults));
  typeFilter.value = "royal";
  renderSubgroups();
  setCharacterView("cards");
  apply();
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
    (org.members || []).forEach((member) => {
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

// 章番号＋イベントID内の連番で並べる（dayがnullの章も正しい順序に収まる）
function sortKey(event) {
  const seq = parseInt(String(event.id).split("-")[1], 10) || 0;
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

function getTimeLabel(event) {
  if (!event.time_start) return null;
  return event.time_end ? `${event.time_start}〜${event.time_end}` : event.time_start;
}

function getLocationKey(event) {
  if (event.location) return event.location;
  if (event.room) return formatRoomLabel(event.room);
  return "場所不明";
}

const ROOM_AREA_DEFINITIONS = [
  ...Array.from({ length: 14 }, (_, index) => {
    const room = String(1001 + index);
    return { id: `room-${room}`, label: room };
  }),
  { id: "layer-2", label: "第2層" },
  { id: "layer-3", label: "第3層" },
  { id: "layer-4", label: "第4層" },
  { id: "layer-5", label: "第5層" },
  { id: "other", label: "その他" }
];

function getRoomAreaIds(event) {
  const location = getLocationKey(event);
  const ids = ROOM_AREA_DEFINITIONS
    .filter((area) => area.id.startsWith("room-") && location.includes(`${area.label}号室`))
    .map((area) => area.id);

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

  if (ids.length === 0) ids.push("other");
  return [...new Set(ids)];
}

function openEventLocation(event) {
  const destination = getRoomAreaIds(event)[0] || "other";
  if (destination.startsWith("room-")) {
    activePlaceGroupId = "layer-1";
    activeRoomAreaId = destination;
  } else {
    activePlaceGroupId = destination;
    activeRoomAreaId = destination;
  }
  activatePrimaryView("places", true);
}

function createParticipantChip(token) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "participant-chip";
  btn.textContent = formatRoyalName(token);
  btn.addEventListener("click", () => {
    document.getElementById("participantFilter").value = formatRoyalName(token);
    applyFilter();
  });
  return btn;
}

function createTimelineCard(event) {
  const item = document.createElement("article");
  const typeClass = event.type ? `type-${event.type}` : "";
  item.className = `timeline-item ${typeClass}`;

  const title = document.createElement("h3");
  title.textContent = event.description;

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
  if (event.day != null) addMeta(`${event.day}日目`);
  const timeLabel = getTimeLabel(event);
  if (timeLabel) addMeta(`時刻: ${timeLabel}`);
  addMeta(`場所: ${getLocationKey(event)}`);
  meta.appendChild(makeCertaintyBadge(event));

  const participantWrapper = document.createElement("div");
  participantWrapper.className = "participant-list";
  participantWrapper.textContent = "参加者: ";
  (event.characters || []).forEach((token, i) => {
    if (i > 0) participantWrapper.appendChild(document.createTextNode(" / "));
    participantWrapper.appendChild(createParticipantChip(token));
  });

  meta.appendChild(participantWrapper);
  item.appendChild(meta);

  if (event.notes) {
    const detail = document.createElement("p");
    detail.textContent = event.notes;
    item.appendChild(detail);
  }

  if ((event.revealed_facts || []).length > 0) {
    const facts = document.createElement("p");
    facts.className = "event-facts";
    facts.textContent = `分かったこと: ${event.revealed_facts.join(" / ")}`;
    item.appendChild(facts);
  }

  if ((event.mysteries || []).length > 0) {
    const mysteries = document.createElement("p");
    mysteries.className = "event-mysteries";
    mysteries.textContent = `謎: ${event.mysteries.join(" / ")}`;
    item.appendChild(mysteries);
  }

  return item;
}

function getUniqueValues(list, key) {
  return [...new Set(list.map((item) => item[key]))].filter(Boolean).sort();
}

function getUniqueParticipants(events) {
  return [...new Set(events.flatMap((e) => e.characters || []))];
}

function applyFilter() {
  const selectedRoom = document.getElementById("roomFilter").value;
  const selectedType = document.getElementById("typeFilter").value;
  const participantQuery = document.getElementById("participantFilter").value.trim().toLowerCase();
  const sortOrder = document.getElementById("timelineSortOrder").value;

  const filtered = eventsData.filter((event) => {
    const loc = getLocationKey(event);
    const roomMatch = selectedRoom === "all" || loc === selectedRoom;
    const typeMatch = selectedType === "all" || event.type === selectedType;
    const participantMatch = participantQuery === ""
      || (event.characters || []).some((c) =>
          formatRoyalName(c).toLowerCase().includes(participantQuery) || c.toLowerCase().includes(participantQuery)
        );
    return roomMatch && typeMatch && participantMatch;
  });

  if (sortOrder === "desc") filtered.reverse();
  filteredEventsData = filtered;
  timelineVisibleCount = 30;
  renderActiveTimelineView();
}

function getTimelineEventsIgnoringType() {
  const selectedRoom = document.getElementById("roomFilter").value;
  const participantQuery = document.getElementById("participantFilter").value.trim().toLowerCase();
  return eventsData.filter((event) => {
    const roomMatch = selectedRoom === "all" || getLocationKey(event) === selectedRoom;
    const participantMatch = participantQuery === ""
      || (event.characters || []).some((token) =>
        formatRoyalName(token).toLowerCase().includes(participantQuery) || token.toLowerCase().includes(participantQuery)
      );
    return roomMatch && participantMatch && getEventPeriodId(event) === activeTimelinePeriodId;
  });
}

function refreshTypeAvailability() {
  const typeFilter = document.getElementById("typeFilter");
  if (!typeFilter?.setAvailability) return false;
  const counts = getTimelineEventsIgnoringType().reduce((result, event) => {
    if (event.type) result[event.type] = (result[event.type] || 0) + 1;
    return result;
  }, {});
  const unavailableSelection = typeFilter.value !== "all" && !counts[typeFilter.value];
  if (unavailableSelection) typeFilter.value = "all";
  typeFilter.setAvailability(counts);
  return unavailableSelection;
}

function resetFilters() {
  document.getElementById("roomFilter").value = "all";
  document.getElementById("typeFilter").value = "all";
  document.getElementById("participantFilter").value = "";
  document.getElementById("timelineSortOrder").value = "asc";
  applyFilter();
}

function setupFilters() {
  const roomFilter = document.getElementById("roomFilter");
  const typeFilter = document.getElementById("typeFilter");
  const participantSelect = document.getElementById("participantSelect");

  const locations = [...new Set(eventsData.map(getLocationKey))].filter(Boolean).sort();
  locations.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = loc;
    roomFilter.appendChild(opt);
  });

  getUniqueValues(eventsData, "type").forEach((type) => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = type;
    typeFilter.appendChild(opt);
  });
  pillify("typeFilter");

  getUniqueParticipants(eventsData)
    .sort((a, b) => formatRoyalName(a).localeCompare(formatRoyalName(b), "ja"))
    .forEach((token) => {
      const opt = document.createElement("option");
      opt.value = token;
      opt.textContent = formatRoyalName(token);
      participantSelect.appendChild(opt);
    });

  participantSelect.addEventListener("change", renderActiveTimelineView);
  document.getElementById("roomFilter").addEventListener("change", applyFilter);
  document.getElementById("typeFilter").addEventListener("change", applyFilter);
  document.getElementById("timelineSortOrder").addEventListener("change", applyFilter);
  document.getElementById("participantFilter").addEventListener("input", applyFilter);
  document.getElementById("clearFilters").addEventListener("click", resetFilters);
  document.getElementById("timelineLoadMore").addEventListener("click", () => {
    timelineVisibleCount += 30;
    renderTimeline(filteredEventsData);
  });

  applyFilter();
}

function renderActiveTimelineView() {
  const events = filteredEventsData;
  if (activeTimelineView === "schedule") {
    renderTimelineSchedule(events);
  } else if (activeTimelineView === "events") {
    renderTimeline(events);
  } else if (activeTimelineView === "rooms") {
    renderRoomAreaTimeline(events);
  } else if (activeTimelineView === "person") {
    const token = document.getElementById("participantSelect").value;
    renderPersonTimeline(token, events);
  } else if (activeTimelineView === "matrix") {
    renderTimelineMatrix(events);
  } else if (activeTimelineView === "gantt") {
    renderGanttChart(events);
  }
}

function activateTimelineView(view, moveFocus = false) {
  const tabs = Array.from(document.querySelectorAll(".timeline-view-tab"));
  const selectedTab = tabs.find((tab) => tab.dataset.view === view);
  if (!selectedTab) return;

  activeTimelineView = view;
  if (view !== "schedule") document.getElementById("typeFilter")?.setAvailability?.(null);
  tabs.forEach((tab) => {
    const active = tab === selectedTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel) panel.hidden = !active;
  });

  renderActiveTimelineView();
  if (moveFocus) selectedTab.focus();
}

function setupTimelineTabs() {
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

function renderRoomAreaTimeline(events) {
  const groupTabs = document.getElementById("placeGroupTabs");
  const tabs = document.getElementById("roomAreaTabs");
  const summary = document.getElementById("roomAreaSummary");
  const container = document.getElementById("roomTimeline");
  const peopleContainer = document.getElementById("roomPeople");
  const visitorsContainer = document.getElementById("roomVisitors");
  const placeGroups = [
    { id: "layer-1", label: "第1層・王子居住区" },
    { id: "layer-2", label: "第2層" },
    { id: "layer-3", label: "第3層" },
    { id: "layer-4", label: "第4層" },
    { id: "layer-5", label: "第5層" },
    { id: "other", label: "その他" }
  ];
  groupTabs.innerHTML = "";
  placeGroups.forEach((group) => {
    const button = document.createElement("button");
    const active = group.id === activePlaceGroupId;
    button.type = "button";
    button.className = `place-group-tab${active ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(active));
    button.textContent = group.label;
    button.addEventListener("click", () => {
      activePlaceGroupId = group.id;
      if (group.id === "layer-1") {
        if (!activeRoomAreaId.startsWith("room-")) activeRoomAreaId = "room-1001";
      } else {
        activeRoomAreaId = group.id;
      }
      renderRoomAreaTimeline(eventsData);
    });
    groupTabs.appendChild(button);
  });

  tabs.innerHTML = "";
  const visibleAreas = activePlaceGroupId === "layer-1"
    ? ROOM_AREA_DEFINITIONS.filter((area) => area.id.startsWith("room-"))
    : [];
  visibleAreas.forEach((area) => {
    const button = document.createElement("button");
    const active = area.id === activeRoomAreaId;
    button.type = "button";
    button.className = `room-area-tab${active ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(active));
    button.textContent = area.label;
    button.addEventListener("click", () => {
      activeRoomAreaId = area.id;
      renderRoomAreaTimeline(eventsData);
    });
    tabs.appendChild(button);
  });
  tabs.hidden = visibleAreas.length === 0;

  const selectedArea = ROOM_AREA_DEFINITIONS.find((area) => area.id === activeRoomAreaId);
  const selectedEvents = events
    .filter((event) => getRoomAreaIds(event).includes(activeRoomAreaId))
    .slice()
    .sort((a, b) => sortKey(a) - sortKey(b));

  const participantIds = new Set(selectedEvents.flatMap((event) => event.characters || []));
  const currentPeople = charactersData.filter((character) => {
    const latest = getLatestKnownLocation(character);
    return latest && getRoomAreaIds({ location: latest.location }).includes(activeRoomAreaId);
  }).sort(sortCharacters);
  const currentIds = new Set(currentPeople.map((character) => character.id));
  const visitors = charactersData.filter((character) =>
    !currentIds.has(character.id) && (participantIds.has(character.id) || participantIds.has(character.name))
  ).sort(sortCharacters);

  const renderPeopleChips = (target, people, emptyText) => {
    target.innerHTML = "";
    if (people.length === 0) {
      target.textContent = emptyText;
      return;
    }
    people.forEach((character) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "room-person-chip";
      const latest = getLatestKnownLocation(character);
      chip.textContent = latest ? `${formatRoyalName(character.id)}｜${latest.basis}` : formatRoyalName(character.id);
      chip.title = latest
        ? `${latest.basis}・${({ confirmed: "確定", provisional: "暫定", estimated: "推定", unknown: "不明" }[latest.certainty])}`
        : (character.role || character.camp || "人物詳細を表示");
      chip.addEventListener("click", () => {
        activatePrimaryView("characters");
        const search = document.getElementById("characterSearch");
        search.value = getDisplayName(character);
        search.dispatchEvent(new Event("input"));
      });
      target.appendChild(chip);
    });
  };
  renderPeopleChips(peopleContainer, currentPeople, "現在地が登録されている人物はいません。");
  renderPeopleChips(visitorsContainer, visitors, "過去の登場人物は登録されていません。");

  summary.textContent = `${selectedArea.label}の人物と出来事`;
  container.innerHTML = "";
  if (selectedEvents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty-state";
    empty.textContent = "現在の絞り込み条件に一致する出来事はありません。";
    container.appendChild(empty);
    return;
  }

  selectedEvents.forEach((event) => {
    const item = document.createElement("article");
    item.className = `room-area-event${event.type ? ` type-${event.type}` : ""}`;

    const marker = document.createElement("div");
    marker.className = "room-area-marker";
    marker.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "room-area-event-content";
    const meta = document.createElement("div");
    meta.className = "room-area-event-meta";
    const chapter = document.createElement("strong");
    chapter.textContent = event.day != null
      ? `${getChapterLabel(event)}・${event.day}日目`
      : getChapterLabel(event);
    const type = document.createElement("span");
    type.className = "event-type";
    type.textContent = event.type || "出来事";
    meta.append(chapter, type, makeCertaintyBadge(event));

    const description = document.createElement("h4");
    description.textContent = event.description;
    const detail = document.createElement("p");
    const participants = (event.characters || []).map(formatRoyalName).join(" / ") || "不明";
    detail.textContent = `${getLocationKey(event)}｜${participants}`;
    content.append(meta, description, detail);
    item.append(marker, content);
    container.appendChild(item);
  });
}

const TIMELINE_PERIODS = [
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
  tabs.innerHTML = "";
  container.innerHTML = "";
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
      if (refreshTypeAvailability()) applyFilter();
      else renderTimelineSchedule(filteredEventsData);
    });
    tabs.appendChild(button);
  });

  const selectedPeriod = TIMELINE_PERIODS.find((period) => period.id === activeTimelinePeriodId);
  const selectedEvents = events
    .filter((event) => getEventPeriodId(event) === activeTimelinePeriodId)
    .slice().sort((a, b) => sortKey(a) - sortKey(b));

  const heading = document.createElement("div");
  heading.className = "schedule-selected-heading";
  const title = document.createElement("h4");
  title.textContent = selectedPeriod.label;
  heading.appendChild(title);
  if (activeTimelinePeriodId === "unknown") {
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
    empty.textContent = "登録されている出来事はありません。";
    container.appendChild(empty);
  } else {
    const orderedEvents = selectedEvents.slice().sort((a, b) => {
      const aTime = parseTimeString(a.time_start);
      const bTime = parseTimeString(b.time_start);
      if (aTime == null && bTime != null) return 1;
      if (aTime != null && bTime == null) return -1;
      if (aTime != null && bTime != null && aTime !== bTime) return aTime - bTime;
      return sortKey(a) - sortKey(b);
    });
    const groups = new Map();
    orderedEvents.forEach((event) => {
      const key = event.time_start || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    });
    const axis = document.createElement("div");
    axis.className = "chronological-axis";
    groups.forEach((groupEvents, timeKey) => {
      const row = document.createElement("section");
      row.className = `chronological-row${timeKey === "unknown" ? " time-unknown" : ""}`;
      const timeColumn = document.createElement("div");
      timeColumn.className = "chronological-time";
      timeColumn.textContent = timeKey === "unknown" ? "時刻不明" : timeKey;
      const eventGrid = document.createElement("div");
      eventGrid.className = "chronological-events";
      groupEvents.forEach((event) => {
        const item = document.createElement("article");
        item.className = "schedule-event";
        item.setAttribute("role", "button");
        item.tabIndex = 0;
        const location = document.createElement("button");
        location.type = "button";
        location.className = "schedule-event-location";
        location.textContent = getLocationKey(event);
        location.title = `${getLocationKey(event)}を場所別ページで開く`;
        location.addEventListener("click", (clickEvent) => {
          clickEvent.stopPropagation();
          openEventLocation(event);
        });
        const chapter = document.createElement("small");
        chapter.className = "schedule-event-chapter";
        chapter.textContent = getChapterLabel(event);
        const description = document.createElement("span");
        description.textContent = event.description;
        const participants = document.createElement("small");
        participants.textContent = (event.characters || []).map(formatRoyalName).join(" / ") || "人物不明";
        item.append(location, chapter, makeCertaintyBadge(event));
        if (activeTimelinePeriodId === "unknown") item.appendChild(makeChronologyBadge(event));
        item.append(description, participants);
        item.addEventListener("click", () => {
          modalReturnFocus = item;
          showDetailModal(event.id, "event", event);
        });
        item.addEventListener("keydown", (keyEvent) => {
          if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
          keyEvent.preventDefault();
          modalReturnFocus = item;
          showDetailModal(event.id, "event", event);
        });
        eventGrid.appendChild(item);
      });
      row.append(timeColumn, eventGrid);
      axis.appendChild(row);
    });
    container.appendChild(axis);
  }

  const note = document.createElement("p");
  note.className = "schedule-note";
  note.textContent = "※ 日付未入力の出来事は推定配置せず「日付不明」へ、411話以降は「暫定」へ分離しています。";
  container.appendChild(note);
}

function renderPersonTimeline(token, sourceEvents = eventsData) {
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

    const label = e.day != null ? `${getChapterLabel(e)} | ${e.day}日目` : getChapterLabel(e);
    const strong = document.createElement("strong");
    strong.textContent = `${label} | ${e.description}`;
    item.appendChild(strong);

    const meta = document.createElement("span");
    meta.textContent = `${getLocationKey(e)} / ${e.type || "出来事"}`;
    item.appendChild(meta);

    if (e.notes) {
      const p = document.createElement("p");
      p.textContent = e.notes;
      item.appendChild(p);
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
        strong.textContent = matched.length === 1 ? matched[0].description : `${matched.length} 件`;
        const span = document.createElement("span");
        const formattedParticipants = (matched[0].characters || []).map(formatRoyalName).join(" / ");
        span.textContent = matched.length === 1
          ? `${matched[0].type || "出来事"} / ${formattedParticipants}`
          : matched.map((e) => e.description).join(", ");
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
    if (event.key === "Escape") {
      event.preventDefault();
      closeDetailModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )).filter((element) => !element.hidden);
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
  P12: ["E349-001", "E360-001"],
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
    return eventsData.filter((event) => eventIds.has(event.id));
  }
  return eventsData.filter((e) => (e.characters || []).some((c) => c === id || c === name));
}

// 「警護兵士」= 現在その王子の部屋・陣営に配置されている全員（camp一致）。
// 雇用主（affiliation）が別の王子・王妃である「他陣営からの配置者」も含む点に注意。
// 一方、position_codeの接頭辞は「誰の私設兵として登録されているか」という台帳上の
// 所属を表すだけで、現在の配置先とは別物（他陣営に潜伏中のスパイなどで両者がズレる）。
function getGuardsForPrince(prince) {
  if (!prince.camp) return [];
  return bodyguardsData.filter((g) => g.camp === prince.camp);
}

// 配置先（camp）と真の所属（affiliation）が一致しない場合、他陣営からの配置者と判定
function isOutsidePlacement(guard) {
  if (!guard.camp || !guard.affiliation) return false;
  return !guard.affiliation.startsWith(guard.camp.replace(/陣営$/, ""));
}

function showDetailModal(name, category, eventData = null) {
  const modal = document.getElementById("detailModal");
  const wasHidden = modal.classList.contains("hidden");
  const titleEl = document.getElementById("modalTitle");
  const content = document.getElementById("modalContent");
  content.innerHTML = "";

  let record, details;
  let extraSections = [];

  if (category === "event" && eventData) {
    record = eventData;
    titleEl.textContent = record.description;
    details = [
      { label: "章", value: getChapterLabel(record) },
      { label: "日", value: record.day != null ? `${record.day}日目` : "—" },
      { label: "時刻", value: getTimeLabel(record) || "—" },
      { label: "場所", value: getLocationKey(record) },
      { label: "陣営", value: (record.camp || []).map(formatRoyalName).join(" / ") },
      { label: "種別", value: record.type || "出来事" },
      { label: "参加者", value: (record.characters || []).map(formatRoyalName).join(" / ") },
      { label: "詳細", value: formatDisplayText(record.notes) || "" }
    ];
    if ((record.revealed_facts || []).length > 0) {
      extraSections.push({ heading: "分かったこと", lines: record.revealed_facts });
    }
    if ((record.mysteries || []).length > 0) {
      extraSections.push({ heading: "謎", lines: record.mysteries });
    }
  } else if (category === "spiritBeast") {
    record = spiritBeastsData.find((b) => b.name === name);
    if (!record) return;
    titleEl.textContent = record.name;
    details = [
      { label: "担当王子", value: formatRoyalName(record.prince) },
      { label: "外見・形態", value: record.appearance || "不明" },
      { label: "念系統", value: record.nen_type || "不明" },
      { label: "能力", value: record.ability || "不明" }
    ];
  } else if (category === "prince") {
    record = princesData.find((p) => p.id === name);
    if (!record) return;
    titleEl.textContent = `第${record.rank}王子${getDisplayName(record)}`;
    details = [
      { label: "年齢", value: record.age != null ? `${record.age}歳` : "不明" },
      { label: "母（王妃）", value: record.queen || "不明" },
      { label: "部屋", value: formatRoomLabel(record.room) || "未配置" },
      { label: "本人の念系統", value: record.nen_type || "不明" },
      { label: "本人の念能力", value: record.nen_ability || "不明" },
      { label: "守護霊獣", value: record.spirit_beast_name || "不明" },
      { label: "状態", value: record.status || "不明" },
      { label: "陣営", value: record.faction_note || "" },
      { label: "備考", value: formatDisplayText(record.notes) || "" }
    ];
  } else {
    record = bodyguardsData.find((g) => g.id === name);
    if (!record) return;
    titleEl.textContent = record.name;
    details = [
      { label: "分類", value: record.soldier_category || "不明" },
      { label: "配置・護衛先", value: formatAssignment(record) || "不明" },
      { label: "所属", value: formatAffiliation(record) || "不明" },
      { label: "現在地", value: formatRoomLabel(record.room || record.location) || "不明" },
      { label: "任務", value: formatDisplayText(record.mission) || "不明" },
      { label: "任務対象", value: formatDisplayText(record.target) || "" },
      { label: "念系統", value: record.nen_type || "不明" },
      { label: "能力", value: record.nen_ability || "不明" },
      { label: "役割", value: record.role || "不明" },
      { label: "念講習会", value: getNenClassLabel(record) || "" },
      { label: "備考", value: formatDisplayText(record.notes) || "" }
    ];
  }

  if (category === "spiritBeast" && record.image) {
    const modalBeastImage = makeBeastImage(record.image, record.name);
    if (modalBeastImage) {
      modalBeastImage.className = "beast-image modal-beast-image";
      content.appendChild(modalBeastImage);
    }
  }

  const dl = document.createElement("dl");
  dl.className = "detail-list";
  details.forEach(({ label, value }) => {
    if (!value || value === "—") return;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  });
  content.appendChild(dl);

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

  if (category === "prince") {
    const guards = getGuardsForPrince(record);
    if (guards.length > 0) {
      const guardDetails = document.createElement("details");
      guardDetails.className = "related-events-spoiler";

      const outsideCount = guards.filter(isOutsidePlacement).length;
      const guardSummary = document.createElement("summary");
      guardSummary.textContent = outsideCount > 0
        ? `警護兵士（${guards.length}件・他陣営からの配置 ${outsideCount}件含む）`
        : `警護兵士（${guards.length}件）`;
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
      content.appendChild(guardDetails);
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
        const label = e.day != null ? `${getChapterLabel(e)}（${e.day}日目）` : getChapterLabel(e);
        const strong = document.createElement("strong");
        strong.textContent = `${label} | ${e.description}`;
        const meta = document.createElement("span");
        meta.textContent = `${getLocationKey(e)} / ${e.type || "出来事"}`;
        const p = document.createElement("p");
        p.textContent = e.notes || "";
        item.append(strong, meta, p);
        list.appendChild(item);
      });
    details.appendChild(list);
    content.appendChild(details);
  }

  if (wasHidden) modalReturnFocus = document.activeElement;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.getElementById("modalClose").focus();
}

function closeDetailModal() {
  const modal = document.getElementById("detailModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
  modalReturnFocus = null;
}

function setupBackToTop() {
  const button = document.getElementById("backToTop");
  const updateVisibility = () => button.classList.toggle("hidden", window.scrollY < 900);
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();
}

function activatePrimaryView(view, updateHash = false) {
  const validView = ["characters", "places", "timeline", "guide"].includes(view) ? view : "characters";
  document.querySelectorAll("[data-primary-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.primaryPanel !== validView;
  });
  document.querySelectorAll("[data-primary-view]").forEach((link) => {
    const active = link.dataset.primaryView === validView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (validView === "places") renderRoomAreaTimeline(eventsData);
  if (updateHash) history.replaceState(null, "", `#${validView}`);
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

async function init() {
  try {
    const [characters, characterImages, events, spiritBeasts, factions, mafia] = await Promise.all([
      loadJson(DATA.characters),
      loadJson(DATA.characterImages),
      loadJson(DATA.events),
      loadJson(DATA.spiritBeasts),
      loadJson(DATA.factions),
      loadJson(DATA.mafia)
    ]);

    const imageByCharacterId = new Map(characterImages.map((entry) => [entry.id, entry]));
    charactersData = characters.map((character) => {
      const imageEntry = imageByCharacterId.get(character.id);
      return imageEntry ? { ...character, image: imageEntry.image, image_source_url: imageEntry.source_url } : character;
    });
    spiritBeastsData = spiritBeasts;
    factionsData = factions;
    mafiaData = mafia;

    princesData = charactersData.filter((c) => c.type === "prince").sort((a, b) => a.rank - b.rank);
    bodyguardsData = charactersData.filter((c) =>
      ["hunter", "soldier", "attendant"].includes(c.type) && c.position_code
    );
    eventsData = [...events].sort((a, b) => sortKey(a) - sortKey(b));

    buildPrinceMap(princesData);
    buildCharMap(charactersData);

    renderCharacterDirectory(charactersData.filter((character) => !BASIC_CHARACTER_IDS.has(character.id)));
    renderBasicCharacters();
    renderSpiritBeasts(spiritBeastsData);
    setupCharacterDirectory();
    setupBeastNenFilter();
    setupDetailModal();
    setupTimelineTabs();
    setupFilters();
    renderRoomAreaTimeline(eventsData);
    setupBackToTop();
    setupPrimaryNavigation();

    if (!["characters", "places", "timeline", "guide"].includes(location.hash.slice(1))) {
      scrollToCurrentHash();
    }
  } catch (err) {
    console.error("データの読み込みに失敗しました", err);
  }
}

init();
