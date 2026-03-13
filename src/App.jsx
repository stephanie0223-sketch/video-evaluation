import { useState, useEffect, useRef } from "react";

// ─── 預設學生名單 ─────────────────────────────────────────────────────────────
const PRESET_STUDENTS = [
  "王正緯","王浩棠","吳承叡","林延平","林玟瑛","柯奕安","洪子杰","洪翊銨",
  "紀承廷","康羽涵","張允澄","張柏黌","郭尹錂","梁峻緁","許立澄","許庭維",
  "許博善","陳仲鼎","陳治惟","陳品亨","陳柏勳","傅義展","游俊書","黃千睿",
  "黃利豐","黃昰輔","黃翊愷","楊天宇","葉育榤","詹陳樺","鄒瑞恩","劉子睿",
  "劉育丞","劉冠辰","鄭松庭","羅英榤"
].map((name, i) => ({ id: String(i + 1), name }));

// ─── 評分標準 ─────────────────────────────────────────────────────────────────
const CRITERIA_GROUPS = [
  {
    key: "voice", label: "語音表現", icon: "🎙️", color: "#1e6b5e", colorLight: "#e6f4f1",
    items: [
      { key: "pronunciation", label: "發音",   weight: 15, desc: "音素正確性、重音位置、咬字清晰" },
      { key: "intonation",    label: "語調",   weight: 15, desc: "抑揚頓挫、語氣變化、問句語調" },
      { key: "fluency",       label: "流暢度", weight: 15, desc: "語速適當、停頓自然、無過多填充詞" },
    ]
  },
  {
    key: "content", label: "內容豐富度", icon: "📚", color: "#2d5a8e", colorLight: "#e8f0f8",
    items: [
      { key: "richness", label: "資訊豐富度", weight: 5, desc: "文化知識深度、補充互動資訊、有趣細節" },
    ]
  },
  {
    key: "guide", label: "導覽員表達技巧", icon: "🎭", color: "#7c3d91", colorLight: "#f5eef8",
    items: [
      { key: "eyeContact", label: "眼神",         weight: 15, desc: "目光接觸、視線分配、眼神自信" },
      { key: "gesture",    label: "手勢",         weight: 15, desc: "手勢自然、配合說明、避免多餘動作" },
      { key: "posture",    label: "姿勢走位",     weight: 5,  desc: "站姿端正、走位流暢、空間運用" },
      { key: "engagement", label: "互動感與感染力", weight: 15, desc: "吸引觀眾、熱情投入、表情生動" },
    ]
  }
];

const GRADE_META = {
  A: { label: "優秀",   color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  B: { label: "良好",   color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  C: { label: "普通",   color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  D: { label: "待改進", color: "#c2410c", bg: "#fff7ed", border: "#fdba74" },
  F: { label: "不及格", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
};

const S = {
  navy: "#1a2744", cream: "#f7f3ed", gold: "#c9922a",
  teal: "#1e6b5e", white: "#ffffff", gray: "#6b7280",
  lightGray: "#f1f0ee", border: "#e2ddd6", red: "#dc2626", purple: "#7c3d91"
};

// ─── localStorage helpers ──────────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
function fmtShort(iso) {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

function ScoreBar({ score, max, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(score / max) * 100}%`, background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: "bold", color, minWidth: 36, textAlign: "right" }}>{score}/{max}</span>
    </div>
  );
}

// ─── Anthropic API call ───────────────────────────────────────────────────────
async function evaluateVideo(base64, mimeType, studentName, topic, studentText) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const criteriaBlock = CRITERIA_GROUPS.map(g =>
    `### ${g.label}\n` + g.items.map(it => `- ${it.label} (${it.weight}分): ${it.desc}`).join("\n")
  ).join("\n\n");

  const prompt = `You are an expert English oral assessment teacher evaluating a student's English cultural tour guide video.

Student: ${studentName}
Tour Topic: ${topic}

Student's prepared content (check if student memorized it WITHOUT reading from notes/script):
"""
${studentText || "(none provided)"}
"""

CRITICAL: Penalize if student is reading, looking down at script/cards, or clearly not memorized.

Score each item strictly:
${criteriaBlock}

Total = 100 points. Grade: A=90-100, B=80-89, C=70-79, D=60-69, F=below 60.

Return ONLY valid JSON, no markdown fences:
{
  "transcript": "<full word-for-word transcript>",
  "readingPenalty": <true|false>,
  "readingNote": "<one sentence in Traditional Chinese on whether student read or performed naturally>",
  "scores": {
    "pronunciation": { "score": <0-15>, "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "intonation":    { "score": <0-15>, "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "fluency":       { "score": <0-15>, "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "richness":      { "score": <0-5>,  "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "eyeContact":    { "score": <0-15>, "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "gesture":       { "score": <0-15>, "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "posture":       { "score": <0-5>,  "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] },
    "engagement":    { "score": <0-15>, "feedback": "<2-3 sentences Traditional Chinese>", "strengths": ["<zh>"], "improvements": ["<zh>"] }
  },
  "totalScore": <0-100>,
  "overallGrade": "<A|B|C|D|F>",
  "overallComment": "<4-5 sentences Traditional Chinese overall summary>",
  "recommendations": ["<actionable tip zh>", "<tip zh>", "<tip zh>"]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 2500,
      messages: [{ role: "user", content: [
        { type: "video", source: { type: "base64", media_type: mimeType, data: base64 } },
        { type: "text", text: prompt }
      ]}]
    })
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "";
  return JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const CLASS_PASSWORD = import.meta.env.VITE_CLASS_PASSWORD || "ateamengineers";

export default function App() {
  const [unlocked, setUnlocked]         = useState(() => loadLS("tg_unlocked", false));
  const [pwInput, setPwInput]           = useState("");
  const [pwError, setPwError]           = useState(false);
  const [view, setView]               = useState("home");
  const [students, setStudents]       = useState(() => {
    const s = loadLS("tg3_students", null);
    return s && s.length > 0 ? s : PRESET_STUDENTS;
  });
  const [submissions, setSubmissions] = useState(() => loadLS("tg3_submissions", []));
  const [currentReport, setCurrentReport] = useState(null);

  // upload state
  const [selStudent, setSelStudent]   = useState("");
  const [topic, setTopic]             = useState("");
  const [studentText, setStudentText] = useState("");
  const [videoFile, setVideoFile]     = useState(null);
  const [videoURL, setVideoURL]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [loadStep, setLoadStep]       = useState(0);
  const [error, setError]             = useState(null);

  // teacher state
  const [newName, setNewName]         = useState("");
  const [teacherTab, setTeacherTab]   = useState("roster");
  const [filterStudent, setFilterStudent] = useState("all");

  // class overview sort
  const [sortKey, setSortKey]         = useState("date");
  const [sortDir, setSortDir]         = useState("desc");

  const fileRef = useRef();

  const LOAD_STEPS = [
    "📂 讀取影片檔案...",
    "🔗 連接 AI 評分引擎...",
    "🎙️ 轉錄語音內容...",
    "👁️ 分析眼神、手勢、姿勢...",
    "📊 計算八項評分細項...",
    "✍️ 撰寫詳細回饋報告..."
  ];

  const saveStudents = (list) => { setStudents(list); saveLS("tg3_students", list); };
  const saveSubmissions = (list) => { setSubmissions(list); saveLS("tg3_submissions", list); };

  const addStudent = () => {
    const n = newName.trim();
    if (!n || students.find(s => s.name === n)) return;
    const nextId = String(students.length + 1);
    saveStudents([...students, { id: nextId, name: n }]);
    setNewName("");
  };

  const handleVideoSelect = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (videoURL) URL.revokeObjectURL(videoURL);
    setVideoFile(f); setVideoURL(URL.createObjectURL(f)); setError(null);
  };

  const handleSubmit = async () => {
    if (!selStudent) { setError("請選擇學生姓名"); return; }
    if (!topic.trim()) { setError("請填寫導覽主題"); return; }
    if (!studentText.trim()) { setError("請貼上導覽文字稿"); return; }
    if (!videoFile) { setError("請上傳影片"); return; }
    if (videoFile.size > 100 * 1024 * 1024) { setError("影片超過 100MB，請壓縮後上傳"); return; }

    setLoading(true); setError(null); let step = 0; setLoadStep(0);
    const t = setInterval(() => { step++; if (step < LOAD_STEPS.length) setLoadStep(step); else clearInterval(t); }, 9000);

    try {
      const b64 = await fileToBase64(videoFile);
      const report = await evaluateVideo(b64, videoFile.type, selStudent, topic, studentText);
      clearInterval(t);
      const sub = {
        id: Date.now().toString(),
        studentName: selStudent,
        topic: topic.trim(),
        date: new Date().toISOString(),
        fileName: videoFile.name,
        studentText,
        report
      };
      const newList = [sub, ...submissions.filter(s => s.studentName !== selStudent)];
      saveSubmissions(newList);
      setCurrentReport(sub);
      setView("report");
    } catch (e) {
      clearInterval(t);
      setError(`評分失敗：${e.message}`);
    } finally { setLoading(false); }
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const getSorted = () => [...submissions].sort((a, b) => {
    if (sortKey === "name") return sortDir === "asc" ? a.studentName.localeCompare(b.studentName) : b.studentName.localeCompare(a.studentName);
    let va, vb;
    if (sortKey === "date")  { va = new Date(a.date); vb = new Date(b.date); }
    else if (sortKey === "total") { va = a.report?.totalScore || 0; vb = b.report?.totalScore || 0; }
    else { va = a.report?.scores?.[sortKey]?.score || 0; vb = b.report?.scores?.[sortKey]?.score || 0; }
    return sortDir === "asc" ? va - vb : vb - va;
  });

  // ── PASSWORD ───────────────────────────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(150deg, ${S.navy} 0%, #253560 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Georgia, serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <h1 style={{ fontSize: 24, color: S.white, margin: "0 0 6px" }}>英語文化導覽員</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "system-ui", margin: 0 }}>口說評量系統</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 24px", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: "system-ui", marginBottom: 10, fontWeight: "bold" }}>🔒 請輸入班級密碼</div>
          <input
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={e => { if (e.key === "Enter") { if (pwInput === CLASS_PASSWORD) { saveLS("tg_unlocked", true); setUnlocked(true); } else setPwError(true); } }}
            placeholder="輸入密碼..."
            autoFocus
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: pwError ? "2px solid #fca5a5" : "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: S.white, fontSize: 16, fontFamily: "system-ui", boxSizing: "border-box", outline: "none", marginBottom: 10 }}
          />
          {pwError && <div style={{ color: "#fca5a5", fontSize: 13, fontFamily: "system-ui", marginBottom: 10 }}>❌ 密碼錯誤，請再試一次</div>}
          <button
            onClick={() => { if (pwInput === CLASS_PASSWORD) { saveLS("tg_unlocked", true); setUnlocked(true); } else setPwError(true); }}
            style={{ width: "100%", background: S.teal, color: S.white, border: "none", borderRadius: 12, padding: "13px", cursor: "pointer", fontSize: 16, fontWeight: "bold", fontFamily: "Georgia, serif" }}>
            進入系統 →
          </button>
        </div>
      </div>
    </div>
  );

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(150deg, ${S.navy} 0%, #253560 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Georgia, serif" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
        <h1 style={{ fontSize: 28, fontWeight: "bold", color: S.white, margin: "0 0 6px" }}>英語文化導覽員</h1>
        <h2 style={{ fontSize: 16, fontWeight: "normal", color: "rgba(255,255,255,0.7)", margin: "0 0 8px" }}>口說評量系統</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "system-ui", margin: 0 }}>English Cultural Tour Guide · AI Speech Assessment</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 16, width: "100%", maxWidth: 640 }}>
        {[
          { icon: "👩‍🏫", title: "老師管理",  sub: "名單管理・查看成績",    v: "teacher",   bg: "rgba(255,255,255,0.1)", bd: "rgba(255,255,255,0.2)" },
          { icon: "🎬",  title: "學生上傳",  sub: "文字 + 影片 → AI評分",  v: "upload",    bg: "rgba(30,107,94,0.85)",  bd: S.teal },
          { icon: "📊",  title: "班級總覽",  sub: "全班成績一覽表",         v: "classview", bg: "rgba(124,61,145,0.85)", bd: S.purple },
        ].map(b => (
          <button key={b.v} onClick={() => setView(b.v)} style={{ background: b.bg, color: S.white, border: `1px solid ${b.bd}`, borderRadius: 16, padding: "24px 16px", cursor: "pointer", textAlign: "center", backdropFilter: "blur(8px)", transition: "transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>{b.icon}</div>
            <div style={{ fontSize: 15, fontWeight: "bold", marginBottom: 4 }}>{b.title}</div>
            <div style={{ fontSize: 11, opacity: 0.8, fontFamily: "system-ui" }}>{b.sub}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 44, display: "flex", gap: 28, flexWrap: "wrap", justifyContent: "center" }}>
        {CRITERIA_GROUPS.map(g => (
          <div key={g.key} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18 }}>{g.icon}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "system-ui", marginTop: 3 }}>{g.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "system-ui" }}>{g.items.reduce((a, i) => a + i.weight, 0)}%</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── CLASS OVERVIEW ─────────────────────────────────────────────────────────
  if (view === "classview") {
    const sorted = getSorted();
    const SortBtn = ({ col, label }) => (
      <button onClick={() => handleSort(col)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: sortKey === col ? S.navy : S.gray, fontWeight: sortKey === col ? "bold" : "normal", padding: "2px", display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
        {label} {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
      </button>
    );
    const thBase = { padding: "9px 8px", background: "#f5f3f0", borderBottom: `2px solid ${S.border}`, textAlign: "center", fontSize: 11 };
    const tdBase = { padding: "9px 8px", borderBottom: `1px solid ${S.lightGray}`, textAlign: "center", fontSize: 13, verticalAlign: "middle" };
    const colorForRatio = r => r >= 0.87 ? "#15803d" : r >= 0.73 ? "#1d4ed8" : r >= 0.6 ? "#b45309" : "#c2410c";

    return (
      <div style={{ minHeight: "100vh", background: S.cream, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: S.purple, color: S.white, padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("home")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: S.white, cursor: "pointer", padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>← 首頁</button>
          <h1 style={{ margin: 0, fontSize: 18, fontFamily: "Georgia, serif" }}>📊 班級成績總覽</h1>
          <span style={{ marginLeft: "auto", fontSize: 13, opacity: 0.8 }}>{submissions.length} 份作業</span>
        </div>
        <div style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
          {submissions.length === 0 ? (
            <div style={{ background: S.white, borderRadius: 16, padding: 60, textAlign: "center", color: S.gray, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 18 }}>尚無任何學生繳交作業</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ borderRadius: 16, border: `1px solid ${S.border}`, overflow: "hidden", minWidth: 900 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thBase, textAlign: "left", minWidth: 110 }} rowSpan={2}><SortBtn col="name" label="學生" /></th>
                      <th style={{ ...thBase, minWidth: 75 }} rowSpan={2}><SortBtn col="date" label="日期" /></th>
                      <th style={{ ...thBase, color: CRITERIA_GROUPS[0].color, borderLeft: `3px solid ${CRITERIA_GROUPS[0].color}` }} colSpan={3}>🎙️ 語音表現 (45%)</th>
                      <th style={{ ...thBase, color: CRITERIA_GROUPS[1].color, borderLeft: `3px solid ${CRITERIA_GROUPS[1].color}` }}>📚 內容 (5%)</th>
                      <th style={{ ...thBase, color: CRITERIA_GROUPS[2].color, borderLeft: `3px solid ${CRITERIA_GROUPS[2].color}` }} colSpan={4}>🎭 導覽技巧 (50%)</th>
                      <th style={{ ...thBase, color: S.navy, borderLeft: `3px solid ${S.navy}` }} rowSpan={2}><SortBtn col="total" label="總分" /></th>
                      <th style={{ ...thBase }} rowSpan={2}>等第</th>
                      <th style={{ ...thBase }} rowSpan={2}></th>
                    </tr>
                    <tr>
                      {[
                        { col: "pronunciation", label: "發音 15%",  bl: `3px solid ${CRITERIA_GROUPS[0].color}` },
                        { col: "intonation",    label: "語調 15%",  bl: "none" },
                        { col: "fluency",       label: "流暢 15%",  bl: "none" },
                        { col: "richness",      label: "豐富 5%",   bl: `3px solid ${CRITERIA_GROUPS[1].color}` },
                        { col: "eyeContact",    label: "眼神 15%",  bl: `3px solid ${CRITERIA_GROUPS[2].color}` },
                        { col: "gesture",       label: "手勢 15%",  bl: "none" },
                        { col: "posture",       label: "走位 5%",   bl: "none" },
                        { col: "engagement",    label: "互動 15%",  bl: "none" },
                      ].map(h => (
                        <th key={h.col} style={{ ...thBase, borderLeft: h.bl || `1px solid ${S.lightGray}` }}>
                          <SortBtn col={h.col} label={h.label} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((sub, idx) => {
                      const sc = sub.report?.scores || {};
                      const total = sub.report?.totalScore || 0;
                      const grade = sub.report?.overallGrade || "—";
                      const gm = GRADE_META[grade] || { color: S.gray, bg: S.white, border: S.border };
                      const ScoreCell = ({ itemKey, max, borderLeft }) => {
                        const s = sc[itemKey]?.score;
                        return (
                          <td style={{ ...tdBase, borderLeft: borderLeft || `1px solid ${S.lightGray}` }}>
                            {s !== undefined ? <span style={{ fontWeight: "bold", color: colorForRatio(s / max), fontSize: 14 }}>{s}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                        );
                      };
                      return (
                        <tr key={sub.id} style={{ background: idx % 2 === 0 ? S.white : "#fdfcfb" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#eef2ff"}
                          onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? S.white : "#fdfcfb"}>
                          <td style={{ ...tdBase, textAlign: "left", padding: "9px 12px" }}>
                            <div style={{ fontWeight: "bold", color: S.navy, fontSize: 13 }}>{sub.studentName}</div>
                            <div style={{ fontSize: 11, color: S.gray }}>{sub.topic}</div>
                            {sub.report?.readingPenalty && <div style={{ fontSize: 10, color: S.red }}>⚠️ 疑似看稿</div>}
                          </td>
                          <td style={{ ...tdBase, fontSize: 11, color: S.gray, whiteSpace: "nowrap" }}>{fmtShort(sub.date)}</td>
                          <ScoreCell itemKey="pronunciation" max={15} borderLeft={`3px solid ${CRITERIA_GROUPS[0].color}`} />
                          <ScoreCell itemKey="intonation"    max={15} />
                          <ScoreCell itemKey="fluency"       max={15} />
                          <ScoreCell itemKey="richness"      max={5}  borderLeft={`3px solid ${CRITERIA_GROUPS[1].color}`} />
                          <ScoreCell itemKey="eyeContact"    max={15} borderLeft={`3px solid ${CRITERIA_GROUPS[2].color}`} />
                          <ScoreCell itemKey="gesture"       max={15} />
                          <ScoreCell itemKey="posture"       max={5} />
                          <ScoreCell itemKey="engagement"    max={15} />
                          <td style={{ ...tdBase, borderLeft: `3px solid ${S.navy}`, fontFamily: "Georgia", fontSize: 18, fontWeight: "bold", color: S.navy }}>{total}</td>
                          <td style={{ ...tdBase }}>
                            <span style={{ background: gm.bg, color: gm.color, border: `1px solid ${gm.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: "bold", fontSize: 12 }}>{grade}</span>
                          </td>
                          <td style={{ ...tdBase }}>
                            <button onClick={() => { setCurrentReport(sub); setView("report"); }} style={{ background: S.purple, color: S.white, border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>報告→</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {submissions.length > 0 && (() => {
            const totals = submissions.map(s => s.report?.totalScore || 0);
            const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1);
            const gradeDist = submissions.reduce((acc, s) => { const g = s.report?.overallGrade || "F"; acc[g] = (acc[g] || 0) + 1; return acc; }, {});
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginTop: 18 }}>
                {[
                  { label: "班級平均", val: `${avg} 分`, col: S.navy },
                  { label: "最高分", val: `${Math.max(...totals)} 分`, col: "#15803d" },
                  { label: "最低分", val: `${Math.min(...totals)} 分`, col: S.red },
                  { label: "人數", val: `${submissions.length} 位`, col: S.purple },
                ].map(st => (
                  <div key={st.label} style={{ background: S.white, borderRadius: 12, padding: 14, border: `1px solid ${S.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: S.gray, marginBottom: 4 }}>{st.label}</div>
                    <div style={{ fontSize: 19, fontWeight: "bold", color: st.col, fontFamily: "Georgia" }}>{st.val}</div>
                  </div>
                ))}
                <div style={{ background: S.white, borderRadius: 12, padding: 14, border: `1px solid ${S.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: S.gray, marginBottom: 8 }}>等第分佈</div>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                    {["A","B","C","D","F"].map(g => gradeDist[g] ? (
                      <span key={g} style={{ background: GRADE_META[g].bg, color: GRADE_META[g].color, border: `1px solid ${GRADE_META[g].border}`, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: "bold" }}>{g}:{gradeDist[g]}</span>
                    ) : null)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── TEACHER ────────────────────────────────────────────────────────────────
  if (view === "teacher") {
    const filtered = filterStudent === "all" ? submissions : submissions.filter(s => s.studentName === filterStudent);
    return (
      <div style={{ minHeight: "100vh", background: S.cream, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: S.navy, color: S.white, padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("home")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: S.white, cursor: "pointer", padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>← 首頁</button>
          <h1 style={{ margin: 0, fontSize: 18, fontFamily: "Georgia, serif" }}>👩‍🏫 老師管理介面</h1>
          <span style={{ marginLeft: "auto", fontSize: 13, opacity: 0.7 }}>{students.length} 學生・{submissions.length} 份作業</span>
        </div>
        <div style={{ display: "flex", borderBottom: `2px solid ${S.border}`, background: S.white, padding: "0 24px" }}>
          {["roster","submissions"].map(tab => (
            <button key={tab} onClick={() => setTeacherTab(tab)} style={{ background: "none", border: "none", padding: "13px 20px", cursor: "pointer", fontSize: 14, fontWeight: teacherTab === tab ? "bold" : "normal", color: teacherTab === tab ? S.navy : S.gray, borderBottom: teacherTab === tab ? `3px solid ${S.navy}` : "3px solid transparent" }}>
              {tab === "roster" ? "📋 學生名單" : "📂 繳交記錄"}
            </button>
          ))}
        </div>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "22px 16px" }}>
          {teacherTab === "roster" && (
            <>
              <div style={{ background: S.white, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${S.border}` }}>
                <h3 style={{ margin: "0 0 12px", color: S.navy, fontSize: 15 }}>新增學生</h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addStudent()} placeholder="輸入學生姓名" style={{ flex: 1, padding: "10px 14px", border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 15, outline: "none" }} />
                  <button onClick={addStudent} style={{ background: S.navy, color: S.white, border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: "bold" }}>新增</button>
                </div>
                <button onClick={() => { if (window.confirm("確定還原為預設 36 位學生名單？")) saveStudents(PRESET_STUDENTS); }} style={{ marginTop: 10, background: "none", color: S.gray, border: `1px solid ${S.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>↺ 還原預設名單（36 位）</button>
              </div>
              <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.border}` }}>
                {students.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "11px 20px", borderBottom: i < students.length - 1 ? `1px solid ${S.lightGray}` : "none" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: S.navy, color: S.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 12, marginRight: 14, flexShrink: 0 }}>{s.id}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", color: S.navy }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: S.gray }}>已繳 {submissions.filter(x => x.studentName === s.name).length} 份</div>
                    </div>
                    <button onClick={() => saveStudents(students.filter(x => x.id !== s.id))} style={{ background: "#fef2f2", color: S.red, border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 13 }}>移除</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {teacherTab === "submissions" && (
            <>
              <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ fontSize: 14, color: S.gray }}>篩選：</label>
                <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={{ padding: "8px 14px", border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14 }}>
                  <option value="all">全部學生</option>
                  {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              {filtered.length === 0
                ? <div style={{ background: S.white, borderRadius: 14, padding: 48, textAlign: "center", color: S.gray, border: `1px solid ${S.border}` }}><div style={{ fontSize: 36 }}>📭</div>尚無記錄</div>
                : filtered.map(sub => {
                  const gm = GRADE_META[sub.report?.overallGrade] || GRADE_META.C;
                  return (
                    <div key={sub.id} style={{ background: S.white, borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: gm.bg, border: `2px solid ${gm.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: gm.color, fontFamily: "Georgia" }}>{sub.report?.overallGrade}</div>
                        <div style={{ fontSize: 9, color: gm.color }}>{sub.report?.totalScore}分</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: "bold", color: S.navy }}>{sub.studentName}</div>
                        <div style={{ fontSize: 12, color: S.gray }}>{sub.topic}・{fmtDate(sub.date)}</div>
                        {sub.report?.readingPenalty && <div style={{ fontSize: 11, color: S.red }}>⚠️ AI 偵測疑似看稿</div>}
                      </div>
                      <button onClick={() => { setCurrentReport(sub); setView("report"); }} style={{ background: S.navy, color: S.white, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>查看報告</button>
                    </div>
                  );
                })
              }
            </>
          )}
        </div>
      </div>
    );
  }

  // ── UPLOAD ─────────────────────────────────────────────────────────────────
  if (view === "upload") return (
    <div style={{ minHeight: "100vh", background: S.cream, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: S.teal, color: S.white, padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setView("home")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: S.white, cursor: "pointer", padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>← 首頁</button>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "Georgia, serif" }}>🎬 上傳影片評分</h1>
      </div>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "22px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
          {CRITERIA_GROUPS.map(g => (
            <div key={g.key} style={{ background: S.white, borderRadius: 14, padding: 14, borderTop: `4px solid ${g.color}`, border: `1px solid ${S.border}`, borderTopColor: g.color }}>
              <div style={{ fontSize: 18, marginBottom: 5 }}>{g.icon}</div>
              <div style={{ fontSize: 12, fontWeight: "bold", color: g.color, marginBottom: 8 }}>{g.label}</div>
              {g.items.map(it => (
                <div key={it.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: S.gray, marginBottom: 3 }}>
                  <span>{it.label}</span><span style={{ fontWeight: "bold", color: g.color }}>{it.weight}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ background: "#fef3e2", border: `1px solid #fcd34d`, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
          ⚠️ <strong>注意：</strong>必須<strong>無稿自然演出</strong>。AI 會偵測是否看稿並列入評分！
        </div>
        <div style={{ background: S.white, borderRadius: 16, padding: 24, border: `1px solid ${S.border}` }}>
          {/* Student */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: "bold", color: S.navy, marginBottom: 8 }}>學生姓名 *</label>
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} style={{ width: "100%", padding: "11px 14px", border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 15, background: S.white }}>
              <option value="">— 請選擇 —</option>
              {students.map(s => <option key={s.id} value={s.name}>{s.id}. {s.name}</option>)}
            </select>
          </div>
          {/* Topic */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: "bold", color: S.navy, marginBottom: 8 }}>導覽主題 *</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="例：台北故宮博物院、九份老街、日月潭..." style={{ width: "100%", padding: "11px 14px", border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 15, boxSizing: "border-box", outline: "none" }} />
          </div>
          {/* Script */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: "bold", color: S.navy, marginBottom: 4 }}>
              導覽準備文字稿 *
              <span style={{ fontWeight: "normal", color: S.gray, fontSize: 12, marginLeft: 6 }}>（AI 用此核對是否背稿演出）</span>
            </label>
            <textarea value={studentText} onChange={e => setStudentText(e.target.value)} rows={6} placeholder="請貼上你準備的導覽內容、重點介紹、互動問題等..." style={{ width: "100%", padding: "12px 14px", border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, outline: "none", fontFamily: "system-ui" }} />
          </div>
          {/* Video */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: "bold", color: S.navy, marginBottom: 8 }}>
              上傳影片 *
              <span style={{ fontWeight: "normal", color: S.gray, fontSize: 12, marginLeft: 6 }}>MP4，100MB 以內，建議 2–5 分鐘</span>
            </label>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${videoFile ? S.teal : S.border}`, borderRadius: 12, padding: "22px", textAlign: "center", cursor: "pointer", background: videoFile ? "#e8f5f2" : S.lightGray }}>
              {videoFile ? (
                <><div style={{ fontSize: 26, marginBottom: 6 }}>✅</div><div style={{ fontWeight: "bold", color: S.teal }}>{videoFile.name}</div><div style={{ fontSize: 12, color: S.gray, marginTop: 4 }}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB・點擊更換</div></>
              ) : (
                <><div style={{ fontSize: 32, marginBottom: 8 }}>🎥</div><div style={{ color: S.navy, fontWeight: "bold" }}>點擊選擇影片</div><div style={{ fontSize: 12, color: S.gray, marginTop: 4 }}>MP4 / MOV / WebM</div></>
              )}
            </div>
            <input ref={fileRef} type="file" accept="video/*" onChange={handleVideoSelect} style={{ display: "none" }} />
          </div>
          {videoURL && <video src={videoURL} controls style={{ width: "100%", borderRadius: 12, maxHeight: 230, marginBottom: 18 }} />}
          {error && <div style={{ background: "#fef2f2", border: `1px solid #fca5a5`, borderRadius: 10, padding: "12px 14px", color: S.red, fontSize: 14, marginBottom: 16 }}>⚠️ {error}</div>}
          {loading ? (
            <div style={{ background: "#e8f5f2", borderRadius: 14, padding: 26, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10, animation: "spin 2s linear infinite", display: "inline-block" }}>⚙️</div>
              <div style={{ color: S.teal, fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>AI 評分中，請稍候...</div>
              <div style={{ color: S.gray, fontSize: 14, marginBottom: 12 }}>{LOAD_STEPS[loadStep]}</div>
              <div style={{ height: 6, background: "#d1fae5", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", background: S.teal, borderRadius: 3, width: `${((loadStep + 1) / LOAD_STEPS.length) * 100}%`, transition: "width 1s ease" }} />
              </div>
              <div style={{ fontSize: 12, color: S.gray, marginTop: 8 }}>預計 30–90 秒</div>
            </div>
          ) : (
            <button onClick={handleSubmit} disabled={!selStudent || !topic.trim() || !videoFile || !studentText.trim()}
              style={{ width: "100%", background: (!selStudent || !topic.trim() || !videoFile || !studentText.trim()) ? "#9ca3af" : S.teal, color: S.white, border: "none", borderRadius: 12, padding: "15px", cursor: (!selStudent || !topic.trim() || !videoFile || !studentText.trim()) ? "not-allowed" : "pointer", fontSize: 17, fontWeight: "bold", fontFamily: "Georgia, serif" }}>
              🚀 送出，開始 AI 評分
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── REPORT ─────────────────────────────────────────────────────────────────
  if (view === "report" && currentReport) {
    const { report, studentName, topic: rTopic, date, studentText: sText } = currentReport;
    const gm = GRADE_META[report?.overallGrade] || GRADE_META.C;
    const sc = report?.scores || {};
    return (
      <div style={{ minHeight: "100vh", background: S.cream, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: S.navy, color: S.white, padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("classview")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: S.white, cursor: "pointer", padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>← 班級總覽</button>
          <h1 style={{ margin: 0, fontSize: 18, fontFamily: "Georgia, serif" }}>📄 評分報告書</h1>
          <button onClick={() => window.print()} style={{ marginLeft: "auto", background: S.gold, color: S.white, border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: "bold" }}>🖨️ 列印 / PDF</button>
        </div>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px" }}>
          {/* Cover */}
          <div style={{ background: S.navy, borderRadius: 20, padding: "28px 32px", marginBottom: 20, color: S.white }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, opacity: 0.45, letterSpacing: 2, marginBottom: 6 }}>ENGLISH CULTURAL TOUR GUIDE · ASSESSMENT REPORT</div>
                <h2 style={{ fontFamily: "Georgia", fontSize: 22, margin: "0 0 5px" }}>英語文化導覽員口說評量</h2>
                <div style={{ fontSize: 18, marginBottom: 10 }}>{studentName}</div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>主題：{rTopic}</div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>日期：{fmtDate(date)}</div>
                {report?.readingPenalty && (
                  <div style={{ marginTop: 10, background: "rgba(220,38,38,0.2)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fca5a5" }}>⚠️ {report.readingNote}</div>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 90, height: 90, borderRadius: "50%", background: gm.bg, border: `4px solid ${gm.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: "bold", color: gm.color, fontFamily: "Georgia" }}>{report?.overallGrade}</div>
                  <div style={{ fontSize: 10, color: gm.color }}>{gm.label}</div>
                </div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: "bold" }}>{report?.totalScore} 分</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>/ 100 分</div>
              </div>
            </div>
          </div>
          {/* Score summary */}
          <div style={{ background: S.white, borderRadius: 16, padding: 22, marginBottom: 18, border: `1px solid ${S.border}` }}>
            <h3 style={{ margin: "0 0 14px", color: S.navy, fontSize: 15 }}>📊 各項分數總覽</h3>
            {CRITERIA_GROUPS.map(g => (
              <div key={g.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: g.color, marginBottom: 8 }}>{g.icon} {g.label}　小計 {g.items.reduce((a, it) => a + (sc[it.key]?.score || 0), 0)}/{g.items.reduce((a, it) => a + it.weight, 0)}</div>
                {g.items.map(it => (
                  <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <div style={{ width: 72, fontSize: 12, color: S.gray, flexShrink: 0, textAlign: "right" }}>{it.label}</div>
                    <div style={{ flex: 1 }}><ScoreBar score={sc[it.key]?.score || 0} max={it.weight} color={g.color} /></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Overall comment */}
          <div style={{ background: S.white, borderRadius: 16, padding: 22, marginBottom: 16, border: `1px solid ${S.border}` }}>
            <h3 style={{ margin: "0 0 12px", color: S.navy, fontSize: 15 }}>💬 整體評語</h3>
            <p style={{ margin: 0, color: "#374151", lineHeight: 1.8, fontSize: 14 }}>{report?.overallComment}</p>
          </div>
          {/* Detail per group */}
          {CRITERIA_GROUPS.map(g => (
            <div key={g.key} style={{ background: S.white, borderRadius: 16, padding: 22, marginBottom: 16, border: `1px solid ${S.border}`, borderTop: `4px solid ${g.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>{g.icon}</span>
                <div>
                  <h3 style={{ margin: 0, color: g.color, fontSize: 15 }}>{g.label}</h3>
                  <div style={{ fontSize: 12, color: S.gray }}>小計：{g.items.reduce((a, it) => a + (sc[it.key]?.score || 0), 0)} / {g.items.reduce((a, it) => a + it.weight, 0)} 分</div>
                </div>
              </div>
              {g.items.map((it, idx) => {
                const s = sc[it.key]; if (!s) return null;
                return (
                  <div key={it.key} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < g.items.length - 1 ? `1px solid ${S.lightGray}` : "none" }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: "bold", color: g.color, fontSize: 14 }}>{it.label}</span>
                      <span style={{ fontSize: 11, color: S.gray, marginLeft: 8 }}>{it.desc}</span>
                    </div>
                    <div style={{ marginBottom: 10 }}><ScoreBar score={s.score} max={it.weight} color={g.color} /></div>
                    <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 13, lineHeight: 1.7 }}>{s.feedback}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: "bold", color: "#15803d", marginBottom: 5 }}>✅ 優點</div>
                        {(s.strengths || []).map((x, i) => <div key={i} style={{ fontSize: 12, color: "#166534", background: "#f0fdf4", borderRadius: 7, padding: "4px 10px", marginBottom: 4 }}>• {x}</div>)}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: "bold", color: "#b45309", marginBottom: 5 }}>📌 改善建議</div>
                        {(s.improvements || []).map((x, i) => <div key={i} style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", borderRadius: 7, padding: "4px 10px", marginBottom: 4 }}>• {x}</div>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {/* Recommendations */}
          {report?.recommendations?.length > 0 && (
            <div style={{ background: "#eff6ff", borderRadius: 16, padding: 20, marginBottom: 16, border: `1px solid #bfdbfe` }}>
              <h3 style={{ margin: "0 0 12px", color: "#1d4ed8", fontSize: 15 }}>🎯 後續學習建議</h3>
              {report.recommendations.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 9 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1d4ed8", color: S.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.6 }}>{r}</div>
                </div>
              ))}
            </div>
          )}
          {/* Transcript */}
          {report?.transcript && (
            <div style={{ background: S.white, borderRadius: 16, padding: 20, marginBottom: 14, border: `1px solid ${S.border}` }}>
              <h3 style={{ margin: "0 0 12px", color: S.navy, fontSize: 15 }}>📝 AI 轉錄逐字稿</h3>
              <div style={{ background: S.lightGray, borderRadius: 10, padding: 16, lineHeight: 1.9, fontSize: 14, color: "#374151", fontFamily: "Georgia, serif", whiteSpace: "pre-wrap", borderLeft: `4px solid ${S.border}` }}>{report.transcript}</div>
            </div>
          )}
          {sText && (
            <div style={{ background: S.white, borderRadius: 16, padding: 20, border: `1px solid ${S.border}` }}>
              <h3 style={{ margin: "0 0 12px", color: S.navy, fontSize: 15 }}>📄 學生繳交文字稿</h3>
              <div style={{ background: S.lightGray, borderRadius: 10, padding: 16, lineHeight: 1.9, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", borderLeft: `4px solid #d1d5db` }}>{sText}</div>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 11, color: S.gray }}>由 AI 英語文化導覽員口說評分系統自動生成・{fmtDate(date)}</div>
        </div>
        <style>{`@media print{button{display:none!important;}body{background:white!important;}}`}</style>
      </div>
    );
  }

  return null;
}
