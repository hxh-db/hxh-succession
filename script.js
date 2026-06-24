const DATA = {
  characters: "data/characters.json",
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
let PRINCE_MAP = {}; // 王子の正式名 → { rank, short }
let CHAR_MAP = {}; // id → character

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
    if (char.type === "prince") return `第${char.rank}王子${char.name.split("＝")[0]}`;
    return char.name;
  }
  const entry = PRINCE_MAP[token];
  if (entry) return `第${entry.rank}王子${entry.short}`;
  return token;
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

// カード一覧に「関連イベントN件」を表示し、モーダルを開く前に件数が分かるようにする
function makeEventCountBadge(record, category) {
  const count = getRelatedEvents(record, category).length;
  if (count === 0) return null;
  const span = document.createElement("span");
  span.className = "event-count-badge";
  span.textContent = `関連イベント ${count}件`;
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

  function render() {
    container.innerHTML = "";
    Array.from(selectEl.options).forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill" + (opt.value === currentValue ? " active" : "");
      btn.textContent = opt.textContent;
      btn.dataset.value = opt.value;
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
    card.addEventListener("click", onClick);
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
    const title = `第${p.rank}王子 ${p.name}`;
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
  const card = createCard(g.name, items, badges, () => showDetailModal(g.id, "bodyguard"), avatar);
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
        subGrid.className = "card-grid camp-grid";
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
  return `第${event.chapter}話${event.chapter_title ? "：" + event.chapter_title : ""}`;
}

function getTimeLabel(event) {
  if (!event.time_start) return null;
  return event.time_end ? `${event.time_start}〜${event.time_end}` : event.time_start;
}

function getLocationKey(event) {
  if (event.location) return event.location;
  if (event.room) return `${event.room}号室`;
  return "場所不明";
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

  renderTimeline(filtered);
  renderRoomTimeline(filtered);
  renderRoomMap(filtered);
  renderTimelineMatrix(filtered);
  renderGanttChart(filtered);

  const personSelect = document.getElementById("participantSelect");
  if (personSelect && personSelect.value !== "all") {
    renderPersonTimeline(personSelect.value);
  }
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

  participantSelect.addEventListener("change", () =>
    renderPersonTimeline(participantSelect.value)
  );
  document.getElementById("roomFilter").addEventListener("change", applyFilter);
  document.getElementById("typeFilter").addEventListener("change", applyFilter);
  document.getElementById("timelineSortOrder").addEventListener("change", applyFilter);
  document.getElementById("participantFilter").addEventListener("input", applyFilter);
  document.getElementById("clearFilters").addEventListener("click", resetFilters);

  renderRoomMap(eventsData);
  renderPersonTimeline("all");
  applyFilter();
}

function renderTimeline(events) {
  const container = document.getElementById("timelineList");
  container.innerHTML = "";
  events.forEach((e) => container.appendChild(createTimelineCard(e)));
}

function renderRoomMap(events) {
  const container = document.getElementById("roomMap");
  container.innerHTML = "";
  const counts = events.reduce((acc, e) => {
    const loc = getLocationKey(e);
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {});

  Object.keys(counts).sort().forEach((loc) => {
    const card = document.createElement("article");
    card.className = "room-map-card";
    card.addEventListener("click", () => {
      document.getElementById("roomFilter").value = loc;
      applyFilter();
      window.location.hash = "#timeline";
    });
    const h4 = document.createElement("h4");
    h4.textContent = loc;
    const p = document.createElement("p");
    p.textContent = `${counts[loc]} 件のイベント`;
    card.append(h4, p);
    container.appendChild(card);
  });
}

function renderRoomTimeline(events) {
  const container = document.getElementById("roomTimeline");
  container.innerHTML = "";
  const grouped = events.reduce((acc, e) => {
    const loc = getLocationKey(e);
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(e);
    return acc;
  }, {});

  Object.keys(grouped).sort().forEach((loc) => {
    const card = document.createElement("article");
    card.className = "room-card";
    const h4 = document.createElement("h4");
    h4.textContent = loc;
    card.appendChild(h4);

    grouped[loc].sort((a, b) => sortKey(a) - sortKey(b)).forEach((e) => {
      const row = document.createElement("div");
      row.className = "room-event";
      const strong = document.createElement("strong");
      const label = e.day != null ? `${getChapterLabel(e)}（${e.day}日目）` : getChapterLabel(e);
      strong.textContent = `${label} — ${e.description}`;
      const detail = document.createElement("span");
      const formattedParticipants = (e.characters || []).map(formatRoyalName).join(" / ");
      detail.textContent = `${e.type || "出来事"} / ${formattedParticipants}`;
      row.append(strong, detail);
      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

function renderPersonTimeline(token) {
  const container = document.getElementById("personTimeline");
  container.innerHTML = "";
  const filtered = token === "all"
    ? eventsData
    : eventsData.filter((e) => (e.characters || []).some((c) => c === token));

  if (filtered.length === 0) {
    const p = document.createElement("p");
    p.textContent = token === "all"
      ? "表示するイベントがありません。"
      : `${formatRoyalName(token)} に関わるイベントが見つかりませんでした。`;
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

  const grid = document.createElement("div");
  grid.className = "matrix-grid";
  grid.style.gridTemplateColumns = `180px repeat(${chapters.length}, minmax(140px, 1fr))`;

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
      const matched = events.filter(
        (e) => getLocationKey(e) === loc && e.chapter === ch
      );
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
      bar.addEventListener("click", () => showDetailModal(e.id, "event", e));

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
}

function getRelatedEvents(record, category) {
  let id = record.id;
  let name = record.name;
  if (category === "spiritBeast") {
    const prince = charactersData.find((c) => c.name === record.prince);
    id = prince ? prince.id : null;
    name = record.prince;
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
      { label: "詳細", value: record.notes || "" }
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
    titleEl.textContent = `第${record.rank}王子 ${record.name}`;
    details = [
      { label: "年齢", value: record.age != null ? `${record.age}歳` : "不明" },
      { label: "母（王妃）", value: record.queen || "不明" },
      { label: "部屋", value: record.room || "未配置" },
      { label: "本人の念系統", value: record.nen_type || "不明" },
      { label: "本人の念能力", value: record.nen_ability || "不明" },
      { label: "守護霊獣", value: record.spirit_beast_name || "不明" },
      { label: "状態", value: record.status || "不明" },
      { label: "陣営", value: record.faction_note || "" },
      { label: "備考", value: record.notes || "" }
    ];
  } else {
    record = bodyguardsData.find((g) => g.id === name);
    if (!record) return;
    titleEl.textContent = record.name;
    details = [
      { label: "分類", value: record.soldier_category || "不明" },
      { label: "配置先", value: record.camp || "不明" },
      { label: "所属", value: record.affiliation || "不明" },
      { label: "念系統", value: record.nen_type || "不明" },
      { label: "能力", value: record.nen_ability || "不明" },
      { label: "役割", value: record.role || "不明" },
      { label: "備考", value: record.notes || "" }
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
        item.addEventListener("click", () => showDetailModal(g.id, "bodyguard"));
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
    summary.textContent = `関連イベント（${relatedEvents.length}件）`;
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

  modal.classList.remove("hidden");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.add("hidden");
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
    const [characters, events, spiritBeasts, factions, mafia] = await Promise.all([
      loadJson(DATA.characters),
      loadJson(DATA.events),
      loadJson(DATA.spiritBeasts),
      loadJson(DATA.factions),
      loadJson(DATA.mafia)
    ]);

    charactersData = characters;
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

    pillify("princeNenFilter");
    pillify("princeStatusFilter");
    pillify("beastNenFilter");
    pillify("hunterFilter");

    renderPrinces(princesData);
    setupPrinceSearch();

    renderSpiritBeasts(spiritBeastsData);
    setupBeastNenFilter();

    renderBodyguards(bodyguardsData);
    setupBodyguardCategoryFilter();
    setupBodyguardSearch();

    renderFactions(factionsData);
    renderMafia(mafiaData);
    renderMafiaRelationMatrix(mafiaData);

    setupDetailModal();
    setupFilters();

    scrollToCurrentHash();
  } catch (err) {
    console.error("データの読み込みに失敗しました", err);
  }
}

init();
