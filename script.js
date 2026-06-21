const DATA = {
  princes: "data/princes.json",
  bodyguards: "data/bodyguards.json",
  spiritBeasts: "data/spirit_beasts.json",
  factions: "data/factions.json",
  timeline: "data/timeline.json"
};

let timelineEvents = [];
let princesData = [];
let bodyguardsData = [];
let spiritBeastsData = [];
let factionsData = [];
let PRINCE_MAP = {}; // 正式名 → { rank, short }

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

// 王子の正式名 → 「第N王子 名前」、それ以外はそのまま
function formatRoyalName(name) {
  if (!name) return name;
  const entry = PRINCE_MAP[name];
  if (entry) return `第${entry.rank}王子${entry.short}`;
  return name;
}

// ===== バッジ生成ユーティリティ =====

function makeStatusBadge(status) {
  if (!status) return null;
  const span = document.createElement("span");
  span.className = `status-badge status-${status}`;
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

// ===== キャラクターアバター =====

function makeAvatar(label, nenType) {
  const div = document.createElement("div");
  div.className = "char-avatar";
  if (nenType) {
    div.classList.add(`nen-avatar-${nenType.replace("系", "")}`);
  }
  div.textContent = label;
  // 文字数が多い場合は小さくする
  if (label.length >= 3) div.style.fontSize = "0.7rem";
  return div;
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
      { label: "守護霊獣", value: p.spirit_beast_name || "不明" },
      { label: "陣営メモ", value: p.faction_note || "" },
      { label: "備考", value: p.note || "" }
    ];
    const badges = [
      makeStatusBadge(p.status),
      makeNenBadge(p.nen_type)
    ];
    const avatar = makeAvatar(`第${p.rank}`, p.nen_type);
    grid.appendChild(createCard(title, items, badges, () => showDetailModal(p.name, "prince"), avatar));
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
      const textMatch = !q || [p.name, p.queen, p.room, p.status, p.note]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const nenMatch = nen === "all" || p.nen_type === nen;
      const statusMatch = st === "all" || p.status === st;
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
    grid.appendChild(createCard(b.name || `${formatRoyalName(b.prince)}の守護霊獣`, items, badges));
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

function renderBodyguards(guards) {
  const grid = document.getElementById("bodyguard-grid");
  grid.innerHTML = "";
  if (guards.length === 0) {
    grid.textContent = "該当する護衛が見つかりませんでした。";
    return;
  }
  guards.forEach((g) => {
    const items = [
      { label: "担当王子", value: formatRoyalName(g.prince) },
      { label: "念系統", value: g.nen_type || "不明" },
      { label: "能力", value: g.ability || "不明" },
      { label: "役割", value: g.role },
      { label: "備考", value: g.note }
    ];
    const badges = [];
    if (g.is_hunter) badges.push(makeHunterBadge());
    badges.push(makeNenBadge(g.nen_type));
    const initial = g.name.charAt(0);
    const avatar = makeAvatar(initial, g.nen_type);
    grid.appendChild(createCard(g.name, items, badges, () => showDetailModal(g.name, "bodyguard"), avatar));
  });
}

function setupBodyguardSearch() {
  const searchInput = document.getElementById("bodyguardSearch");
  const hunterFilter = document.getElementById("hunterFilter");

  function apply() {
    const q = searchInput.value.trim().toLowerCase();
    const hf = hunterFilter.value;
    const filtered = bodyguardsData.filter((g) => {
      const textMatch = !q || [g.name, g.prince, g.ability, g.role, g.note]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const hunterMatch = hf === "all"
        || (hf === "true" && g.is_hunter)
        || (hf === "false" && !g.is_hunter);
      return textMatch && hunterMatch;
    });
    renderBodyguards(filtered);
  }

  searchInput.addEventListener("input", apply);
  hunterFilter.addEventListener("change", apply);
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

// ===== タイムライン =====

function parseTimeString(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  const chapMatch = String(value).match(/第(\d+)話/);
  if (chapMatch) return parseInt(chapMatch[1], 10);
  return 0;
}

function sortKey(event) {
  if (event.day != null) return event.day * 10000 + (parseTimeString(event.time) || 0);
  if (event.chapter) return parseTimeString(event.chapter);
  return parseTimeString(event.time);
}

function createParticipantChip(name) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "participant-chip";
  btn.textContent = formatRoyalName(name);
  btn.addEventListener("click", () => {
    document.getElementById("participantFilter").value = name;
    applyFilter();
  });
  return btn;
}

function createTimelineCard(event) {
  const item = document.createElement("article");
  const typeClass = event.type ? `type-${event.type}` : "";
  item.className = `timeline-item ${typeClass}`;

  const title = document.createElement("h3");
  title.textContent = event.event;

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

  if (event.chapter) addMeta(event.chapter);
  if (event.day != null) addMeta(`${event.day}日目`);
  if (event.time) addMeta(`時刻: ${event.time}`);
  if (event.location || event.room) addMeta(`場所: ${event.location || event.room}`);

  const participantWrapper = document.createElement("div");
  participantWrapper.className = "participant-list";
  participantWrapper.textContent = "参加者: ";
  (event.participants || []).forEach((name, i) => {
    if (i > 0) participantWrapper.appendChild(document.createTextNode(" / "));
    participantWrapper.appendChild(createParticipantChip(name));
  });

  meta.appendChild(participantWrapper);
  item.appendChild(meta);

  const detail = document.createElement("p");
  detail.textContent = event.summary;
  item.appendChild(detail);

  return item;
}

function getUniqueValues(list, key) {
  return [...new Set(list.map((item) => item[key]))].filter(Boolean).sort();
}

function getUniqueParticipants(events) {
  return [...new Set(events.flatMap((e) => e.participants || []))].sort();
}

function getLocationKey(event) {
  return event.location || event.room || "未設定";
}

function applyFilter() {
  const selectedRoom = document.getElementById("roomFilter").value;
  const selectedType = document.getElementById("typeFilter").value;
  const participantQuery = document.getElementById("participantFilter").value.trim();

  const filtered = timelineEvents.filter((event) => {
    const loc = getLocationKey(event);
    const roomMatch = selectedRoom === "all" || loc === selectedRoom;
    const typeMatch = selectedType === "all" || event.type === selectedType;
    const participantMatch = participantQuery === ""
      || (event.participants || []).some((p) =>
          p.toLowerCase().includes(participantQuery.toLowerCase())
        );
    return roomMatch && typeMatch && participantMatch;
  });

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
  applyFilter();
}

function setupFilters(events) {
  timelineEvents = [...events].sort((a, b) => sortKey(a) - sortKey(b));

  const roomFilter = document.getElementById("roomFilter");
  const typeFilter = document.getElementById("typeFilter");
  const participantSelect = document.getElementById("participantSelect");

  const locations = [...new Set(timelineEvents.map(getLocationKey))].filter(Boolean).sort();
  locations.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = loc;
    roomFilter.appendChild(opt);
  });

  getUniqueValues(timelineEvents, "type").forEach((type) => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = type;
    typeFilter.appendChild(opt);
  });

  getUniqueParticipants(timelineEvents).forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = formatRoyalName(name);
    participantSelect.appendChild(opt);
  });

  participantSelect.addEventListener("change", () =>
    renderPersonTimeline(participantSelect.value)
  );
  document.getElementById("roomFilter").addEventListener("change", applyFilter);
  document.getElementById("typeFilter").addEventListener("change", applyFilter);
  document.getElementById("participantFilter").addEventListener("input", applyFilter);
  document.getElementById("clearFilters").addEventListener("click", resetFilters);

  renderRoomMap(timelineEvents);
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
      const label = e.chapter || (e.day != null ? `${e.day}日目` : e.time) || "";
      strong.textContent = `${label} — ${e.event}`;
      const detail = document.createElement("span");
      const formattedParticipants = (e.participants || []).map(formatRoyalName).join(" / ");
      detail.textContent = `${e.type || "出来事"} / ${formattedParticipants}`;
      row.append(strong, detail);
      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

function renderPersonTimeline(personName) {
  const container = document.getElementById("personTimeline");
  container.innerHTML = "";
  const filtered = personName === "all"
    ? timelineEvents
    : timelineEvents.filter((e) =>
        (e.participants || []).some((p) => p === personName)
      );

  if (filtered.length === 0) {
    const p = document.createElement("p");
    p.textContent = personName === "all"
      ? "表示するイベントがありません。"
      : `${formatRoyalName(personName)} に関わるイベントが見つかりませんでした。`;
    container.appendChild(p);
    return;
  }

  filtered.forEach((e) => {
    const item = document.createElement("div");
    item.className = "person-event";

    const label = e.chapter || (e.day != null ? `${e.day}日目` : "") || e.time || "";
    const strong = document.createElement("strong");
    strong.textContent = label ? `${label} | ${e.event}` : e.event;
    item.appendChild(strong);

    const meta = document.createElement("span");
    meta.textContent = `${getLocationKey(e)} / ${e.type || "出来事"}`;
    item.appendChild(meta);

    const p = document.createElement("p");
    p.textContent = e.summary;
    item.appendChild(p);

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

  const chapters = [...new Set(events.map((e) => e.chapter || e.time).filter(Boolean))]
    .sort((a, b) => parseTimeString(a) - parseTimeString(b));
  const locations = [...new Set(events.map(getLocationKey))].filter(Boolean).sort();

  const grid = document.createElement("div");
  grid.className = "matrix-grid";
  grid.style.gridTemplateColumns = `180px repeat(${chapters.length}, minmax(140px, 1fr))`;

  const blank = document.createElement("div");
  blank.className = "matrix-header-cell";
  blank.textContent = "場所 \\ 章/時";
  grid.appendChild(blank);

  chapters.forEach((ch) => {
    const h = document.createElement("div");
    h.className = "matrix-header-cell";
    h.textContent = ch;
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
        (e) => getLocationKey(e) === loc && (e.chapter || e.time) === ch
      );
      if (matched.length > 0) {
        const typeClass = matched[0].type ? `type-${matched[0].type}` : "";
        cell.classList.add("matrix-event-cell", typeClass);
        const strong = document.createElement("strong");
        strong.textContent = matched.length === 1 ? matched[0].event : `${matched.length} 件`;
        const span = document.createElement("span");
        const formattedParticipants = (matched[0].participants || []).map(formatRoyalName).join(" / ");
        span.textContent = matched.length === 1
          ? `${matched[0].type || "出来事"} / ${formattedParticipants}`
          : matched.map((e) => e.event).join(", ");
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
      const dur = e.duration || 5;
      const startPct = ((startKey - minKey) / range) * 100;
      const widthPct = (dur / range) * 100;
      bar.style.left = startPct + "%";
      bar.style.width = Math.max(widthPct, 4) + "%";
      bar.textContent = e.event;
      bar.title = `${e.chapter || e.time || ""} - ${e.event}`;
      bar.addEventListener("click", () => showDetailModal(e.event, "event", e));

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

function showDetailModal(name, category, eventData = null) {
  const modal = document.getElementById("detailModal");
  const titleEl = document.getElementById("modalTitle");
  const content = document.getElementById("modalContent");
  content.innerHTML = "";

  let record, details;

  if (category === "event" && eventData) {
    record = eventData;
    titleEl.textContent = record.event;
    details = [
      { label: "章", value: record.chapter || "—" },
      { label: "日", value: record.day != null ? `${record.day}日目` : "—" },
      { label: "時刻", value: record.time || "—" },
      { label: "場所", value: getLocationKey(record) },
      { label: "種別", value: record.type || "出来事" },
      { label: "参加者", value: (record.participants || []).map(formatRoyalName).join(" / ") },
      { label: "詳細", value: record.summary }
    ];
  } else if (category === "prince") {
    record = princesData.find((p) => p.name === name);
    if (!record) return;
    titleEl.textContent = `第${record.rank}王子 ${record.name}`;
    details = [
      { label: "年齢", value: record.age != null ? `${record.age}歳` : "不明" },
      { label: "母（王妃）", value: record.queen || "不明" },
      { label: "部屋", value: record.room || "未配置" },
      { label: "念系統", value: record.nen_type || "不明" },
      { label: "守護霊獣", value: record.spirit_beast_name || "不明" },
      { label: "状態", value: record.status || "不明" },
      { label: "陣営", value: record.faction_note || "" },
      { label: "備考", value: record.note || "" }
    ];
  } else {
    record = bodyguardsData.find((g) => g.name === name);
    if (!record) return;
    titleEl.textContent = record.name;
    details = [
      { label: "担当王子", value: formatRoyalName(record.prince) || "不明" },
      { label: "念系統", value: record.nen_type || "不明" },
      { label: "能力", value: record.ability || "不明" },
      { label: "役割", value: record.role || "不明" },
      { label: "備考", value: record.note || "" }
    ];
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

  const relatedEvents = category !== "event"
    ? timelineEvents.filter((e) =>
        (e.participants || []).some((p) => p === record.name)
      )
    : [];

  if (relatedEvents.length > 0) {
    const h4 = document.createElement("h4");
    h4.textContent = "関連イベント";
    content.appendChild(h4);

    const list = document.createElement("div");
    list.className = "event-list";
    relatedEvents.forEach((e) => {
      const item = document.createElement("div");
      item.className = "event-item";
      const label = e.chapter || (e.day != null ? `${e.day}日目` : e.time) || "";
      const strong = document.createElement("strong");
      strong.textContent = label ? `${label} | ${e.event}` : e.event;
      const meta = document.createElement("span");
      meta.textContent = `${getLocationKey(e)} / ${e.type || "出来事"}`;
      const p = document.createElement("p");
      p.textContent = e.summary;
      item.append(strong, meta, p);
      list.appendChild(item);
    });
    content.appendChild(list);
  }

  modal.classList.remove("hidden");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.add("hidden");
}

// ===== 初期化 =====

async function init() {
  try {
    const [princes, bodyguards, spiritBeasts, factions, timeline] = await Promise.all([
      loadJson(DATA.princes),
      loadJson(DATA.bodyguards),
      loadJson(DATA.spiritBeasts),
      loadJson(DATA.factions),
      loadJson(DATA.timeline)
    ]);

    princesData = princes;
    bodyguardsData = bodyguards;
    spiritBeastsData = spiritBeasts;
    factionsData = factions;

    buildPrinceMap(princesData);

    renderPrinces(princesData);
    setupPrinceSearch();

    renderSpiritBeasts(spiritBeastsData);
    setupBeastNenFilter();

    renderBodyguards(bodyguardsData);
    setupBodyguardSearch();

    renderFactions(factionsData);

    setupDetailModal();
    setupFilters(timeline);
  } catch (err) {
    console.error("データの読み込みに失敗しました", err);
  }
}

init();
