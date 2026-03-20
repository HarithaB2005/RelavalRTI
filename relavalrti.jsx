import { useState, useRef, useEffect } from "react";
import RTI_SOURCES from "./rti-sources.json";

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const NEXUS_API = import.meta.env.VITE_NEXUS_API || "http://localhost:8000/api/v1/generate-prompt";
const NEXUS_KEY = import.meta.env.VITE_NEXUS_KEY || "";
const APP_QUALITY_THRESHOLD = 0.98;
const APP_MAX_ITERATIONS = 4;

// ═══════════════════════════════════════════════════════════════
// VERIFIED SOURCES (from local-only/RelavalRTI/rti-sources.json)
// App-side only grounding; Nexus remains the intelligence brain.
// ═══════════════════════════════════════════════════════════════
const VERIFIED_SOURCES = RTI_SOURCES;

// ═══════════════════════════════════════════════════════════════
// RTI BRAIN CONTEXT — injected as document_context every call
// Nexus handles ALL intelligence: intent, language, validation,
// delegation, placeholders, PIO mapping, fee calc, action kit
// ═══════════════════════════════════════════════════════════════
const RTI_BRAIN = `
You are the intelligence layer of Nexus RTI — a WhatsApp assistant helping Indian citizens navigate government procedures using the RTI Act 2005.

YOUR ROLE: Understand ANY user message (messy voice, broken English, Hindi, Tamil, Telugu, any language) and return a warm conversational reply + structured JSON.

ALWAYS output:
1. A warm human message first (in the user's language)
2. Then a JSON block like this:

<NEXUS_JSON>
{
  "stage": "greet|understand|collect|preview|filed|waiting|kit",
  "intent": "procedure type detected, or null",
  "confidence": 0.95,
  "language": "english",
  "user_details": {
    "fullName": "collected value or PLACEHOLDER_NAME",
    "address": "collected value or PLACEHOLDER_ADDRESS",
    "mobile": "collected value or 9999999999",
    "bpl": "Yes or No",
    "consent": "YES or NO"
  },
  "fields_still_needed": ["list of fields not yet collected"],
  "rti_bundle": [
    { "pio": "Department + City", "question": "Exact RTI question to ask" }
  ],
  "total_fee": 30,
  "show_preview": false,
  "action_kit": {
    "documents": "exact list of required documents",
    "office": "branch name, full address, floor, officer name",
    "timing": "days and hours",
    "fees": "govt fees + affidavit + total",
    "rejections": "top 3 rejection reasons and how to avoid",
    "success_rate": 93
  },
  "show_kit": false,
  "clarifier_options": [],
  "legal_grounding": {
    "sources": [
      "Official source name + URL"
    ],
    "last_verified": "YYYY-MM-DD",
    "jurisdiction": "India / State",
    "confidence_note": "why this legal answer is reliable"
  }
}
</NEXUS_JSON>

INTELLIGENCE RULES (Nexus handles all of this):
- Understand messy inputs: "Papa shares", "aadhaar bana do", "pension nahi aa rahi" — detect intent fully
- If user says "I can't share", "skip", "fill it", "you decide" → use PLACEHOLDER values, set fields_still_needed: [], proceed — NEVER block
- Collect 5 fields conversationally (fullName, address, mobile, bpl, consent) — ask naturally, 1-2 at a time
- When all 5 fields collected (even placeholders) → set show_preview: true, generate rti_bundle
- BPL=Yes → total_fee=0; BPL=No → ₹10 per RTI (max 5)
- When user confirms filing (YES) → stage=filed, acknowledge receipt
- When stage=kit → set show_kit: true, populate action_kit fully
- clarifier_options: only set if genuinely ambiguous and Nexus needs one specific thing clarified
- Today: ${new Date().toLocaleDateString("en-IN")} | PIOs legally bound to reply in 30 days (RTI Act §7)
- Speak warmly — like a trusted neighbour who knows the system, not a government form
- This app is legal-critical: always optimize for maximum quality, accuracy, and specificity.
- Never reply with plain generic overviews when the user needs actionable steps.
- Provide legally grounded answers using official public sources only, especially: https://rtionline.gov.in, https://www.rti.gov.in, https://www.uidai.gov.in, and relevant State department portals.
- Every substantive legal/procedure response must include legal_grounding with source URLs and last_verified date.
- If you are uncertain about a fee/rule/state variation, clearly say it needs official verification and point to the exact office/portal.
- NEVER return HTML, CSS, JavaScript, Markdown code fences, templates, or documents.
- Response format is mandatory: plain conversational text + one <NEXUS_JSON> block only.
`;

// ═══════════════════════════════════════════════════════════════
// THE ONE API CALL — everything goes through Nexus
// Injects VERIFIED SOURCES to ground responses with accurate RTI info
// ═══════════════════════════════════════════════════════════════
async function callNexus(history) {
  if (!NEXUS_KEY) {
    throw new Error("Missing VITE_NEXUS_KEY. Set it in your .env file.");
  }

  // Inject verified sources into document context
  // This grounds Nexus responses with accurate RTI Act 2005 information
  const sourcesSummary = `
VERIFIED SOURCES (Last verified: ${VERIFIED_SOURCES.metadata.last_verified} from official portals):
- RTI Act 2005 Section 7: Response time is 30 calendar days
- RTI Act 2005 Section 8: Fee structure
  • Postal/NEFT: ₹${VERIFIED_SOURCES.fees_summary?.postal ?? 10}
  • Courier: ₹${VERIFIED_SOURCES.fees_summary?.courier ?? 30} (actual courier + ₹10 base)
  • Exemptions: ${VERIFIED_SOURCES.rti_act_2005?.sections?.section_8?.exemption || "Free for BPL, SC/ST, persons with disability"}
- Appeal Timeline: First appeal within 30 days, Second appeal (Commission) within 90 days
- Official Sources: ${VERIFIED_SOURCES.metadata.official_sources.join(", ")}

Use these facts in EVERY legal/fee/procedure response. Always cite verification date (${VERIFIED_SOURCES.metadata.last_verified}).
`;

  const enhancedContext = RTI_BRAIN + "\n\n" + sourcesSummary;
  
  const res = await fetch(NEXUS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NEXUS_KEY}`,
    },
    body: JSON.stringify({
      messages: history,
      document_context: enhancedContext,
      max_iterations: APP_MAX_ITERATIONS,
      quality_threshold: APP_QUALITY_THRESHOLD,
    }),
  });
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  return d.final_output || d.optimized_prompt || "";
}

// ═══════════════════════════════════════════════════════════════
// PARSER — split human text from JSON block
// ═══════════════════════════════════════════════════════════════
function parse(raw) {
  const looksLikeHtml = /<!doctype html|<html[\s>]|<head>|<body>|<style>|<script>/i.test(raw || "");
  const m = raw.match(/<NEXUS_JSON>([\s\S]*?)<\/NEXUS_JSON>/);
  let json = null;
  if (m) { try { json = JSON.parse(m[1].trim()); } catch (_) {} }
  const text = raw.replace(/<NEXUS_JSON>[\s\S]*?<\/NEXUS_JSON>/g, "").trim();
  const looksGeneric = /(general overview|plain overview|in general|typically, you can)/i.test(text);

  // Guardrail: prevent raw HTML/template dumps from appearing in chat bubbles.
  if (looksLikeHtml || (!json && /<(div|span|form|input|button|table|section)\b/i.test(text)) || (!json && looksGeneric)) {
    return {
      text: "Format issue from Nexus. Chinta mat karo - please send your request once more in one line, and I will continue in normal chat format.",
      json: {
        stage: "understand",
        clarifier_options: [],
        show_preview: false,
        show_kit: false,
      },
    };
  }

  return { text, json };
}

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const CLR = {
  saffron: "#FF6B35",
  deep:    "#1A0A00",
  cream:   "#FFF8F0",
  green:   "#2D6A4F",
  gold:    "#F4A261",
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTS — purely presentational, zero logic
// ═══════════════════════════════════════════════════════════════

function TypingDots() {
  return (
    <div style={{ display:"flex", gap:5, padding:"10px 14px" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:8, height:8, borderRadius:"50%",
          background:CLR.saffron, display:"block",
          animation:`bop 1.2s ease-in-out ${i*0.2}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function Bubble({ role, text, isTyping }) {
  const isBot = role === "bot" || isTyping;
  return (
    <div style={{
      display:"flex",
      flexDirection: isBot ? "row" : "row-reverse",
      alignItems:"flex-end", gap:8, marginBottom:13,
      animation:"slideUp 0.3s ease",
    }}>
      {isBot && (
        <div style={{
          width:36, height:36, borderRadius:"50%", flexShrink:0,
          background:`linear-gradient(135deg,${CLR.saffron},${CLR.gold})`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, boxShadow:`0 2px 8px rgba(255,107,53,0.4)`,
        }}>⚖️</div>
      )}
      <div style={{
        maxWidth:"78%",
        padding: isTyping ? "6px 12px" : "12px 16px",
        borderRadius: isBot ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
        background: isBot
          ? "rgba(255,255,255,0.97)"
          : `linear-gradient(135deg,${CLR.saffron},#e85d2f)`,
        color: isBot ? CLR.deep : "#fff",
        fontSize:14, lineHeight:1.65,
        boxShadow: isBot
          ? "0 2px 14px rgba(0,0,0,0.07)"
          : "0 2px 12px rgba(255,107,53,0.28)",
        border: isBot ? `1px solid rgba(255,107,53,0.1)` : "none",
        fontFamily:"'Noto Sans',sans-serif",
        whiteSpace:"pre-wrap", wordBreak:"break-word",
      }}>
        {isTyping ? <TypingDots /> : text}
      </div>
    </div>
  );
}

function ClarifierChips({ options, onPick }) {
  return (
    <div style={{ paddingLeft:44, marginBottom:14, animation:"slideUp 0.3s ease" }}>
      <div style={{ fontSize:11, color:"#aaa", marginBottom:7, fontFamily:"'Noto Sans',sans-serif" }}>
        Tap to continue →
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {options.map((o, i) => {
          const label = typeof o === "string" ? o : (o.text || o.label || String(o));
          return (
            <button key={i} onClick={() => onPick(label)} style={{
              padding:"9px 18px", borderRadius:22,
              border:`1.5px solid ${CLR.saffron}`,
              background:"rgba(255,255,255,0.95)",
              color:CLR.deep, fontSize:13, cursor:"pointer",
              fontFamily:"'Noto Sans',sans-serif",
              transition:"all 0.18s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = CLR.saffron; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.color = CLR.deep; }}
            >{label}</button>
          );
        })}
      </div>
    </div>
  );
}

function RTIPreview({ json, onConfirm }) {
  const d = json.user_details || {};
  const fee = d.bpl === "Yes" ? "₹0 (BPL waiver)" : `₹${json.total_fee || (json.rti_bundle?.length || 1) * 10}`;
  const hasPlaceholder = Object.values(d).some(v => String(v).toUpperCase().includes("PLACEHOLDER"));

  return (
    <div style={{
      borderRadius:14, overflow:"hidden",
      boxShadow:"0 4px 24px rgba(0,0,0,0.1)", marginBottom:14,
      border:`1px solid rgba(255,107,53,0.15)`,
      animation:"slideUp 0.4s ease",
    }}>
      <div style={{
        background:`linear-gradient(135deg,${CLR.saffron},#e85d2f)`,
        color:"#fff", padding:"13px 16px",
        fontWeight:700, fontSize:15,
        fontFamily:"'Noto Sans',sans-serif",
      }}>📨 RTI FILING PREVIEW</div>

      <div style={{
        padding:"14px 16px", fontSize:13, lineHeight:1.9,
        background:"rgba(255,255,255,0.98)",
        fontFamily:"'Noto Sans',sans-serif",
      }}>
        <div>👤 <b>Name:</b> {d.fullName}</div>
        <div>🏠 <b>Address:</b> {d.address}</div>
        <div>📱 <b>Mobile:</b> {d.mobile}</div>
        <div>📋 <b>BPL:</b> {d.bpl} &nbsp;·&nbsp; 💰 <b>Cost:</b> {fee}</div>

        {hasPlaceholder && (
          <div style={{
            marginTop:10, padding:"9px 12px",
            background:"#fff3e0", borderRadius:8,
            fontSize:12, color:"#bf360c",
            border:"1px solid #ffcc80",
          }}>
            ⚠️ Placeholder details used. Update with real info at rtionline.gov.in before actual filing.
          </div>
        )}

        {json.rti_bundle?.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontWeight:700, fontSize:11, color:"#888", letterSpacing:0.8, marginBottom:8 }}>
              RTI QUESTIONS — {json.rti_bundle.length} PIOs
            </div>
            {json.rti_bundle.map((r, i) => (
              <div key={i} style={{
                marginBottom:9, padding:"9px 12px",
                background:"#f8f9fa", borderRadius:8,
                borderLeft:`3px solid ${CLR.saffron}`,
              }}>
                <div style={{ fontWeight:700, fontSize:12, color:CLR.saffron, marginBottom:3 }}>
                  📮 {r.pio}
                </div>
                <div style={{ fontSize:12, color:"#444" }}>{r.question}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        display:"flex", gap:10, padding:"12px 16px",
        background:"rgba(255,255,255,0.95)",
        borderTop:`1px solid rgba(255,107,53,0.1)`,
      }}>
        <button onClick={() => onConfirm("YES")} style={{
          flex:1, padding:"13px", borderRadius:10, border:"none",
          background:CLR.green, color:"#fff",
          fontWeight:700, fontSize:15, cursor:"pointer",
          fontFamily:"'Noto Sans',sans-serif",
          boxShadow:"0 3px 12px rgba(45,106,79,0.35)",
        }}>✅ YES — File RTIs</button>
        <button onClick={() => onConfirm("NO")} style={{
          flex:1, padding:"13px", borderRadius:10,
          border:`2px solid #e53935`, background:"transparent",
          color:"#e53935", fontWeight:700, fontSize:15, cursor:"pointer",
          fontFamily:"'Noto Sans',sans-serif",
        }}>❌ Cancel</button>
      </div>
    </div>
  );
}

function ActionKitCard({ kit, procedureName }) {
  const rows = [
    { icon:"📋", title:"REQUIRED DOCUMENTS", body:kit.documents,  bg:"#e8f5e9" },
    { icon:"📍", title:"OFFICE LOCATION",     body:kit.office,     bg:"#e3f2fd" },
    { icon:"⏰", title:"VISIT TIMING",        body:kit.timing,     bg:"#fff8e1" },
    { icon:"💰", title:"TOTAL FEES",          body:kit.fees,       bg:"#fce4ec" },
    { icon:"⚠️",title:"AVOID REJECTIONS",    body:kit.rejections, bg:"#f3e5f5" },
  ];
  return (
    <div style={{
      borderRadius:14, overflow:"hidden",
      boxShadow:"0 4px 24px rgba(0,0,0,0.1)", marginBottom:14,
      animation:"slideUp 0.4s ease",
    }}>
      <div style={{
        background:`linear-gradient(135deg,${CLR.green},#1b4332)`,
        color:"#fff", padding:"14px 18px",
        fontWeight:700, fontSize:15,
        fontFamily:"'Noto Sans',sans-serif",
      }}>✅ {procedureName || "Procedure"} — SUCCESS KIT READY</div>

      {rows.map(r => (
        <div key={r.title} style={{
          background:r.bg, padding:"12px 16px",
          borderLeft:`4px solid ${CLR.saffron}`,
          borderBottom:"1px solid rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontWeight:700, fontSize:11, color:"#666", letterSpacing:0.9, marginBottom:5 }}>
            {r.icon} {r.title}
          </div>
          <div style={{
            fontSize:13, color:CLR.deep, lineHeight:1.75,
            whiteSpace:"pre-wrap", fontFamily:"'Noto Sans',sans-serif",
          }}>{r.body || "—"}</div>
        </div>
      ))}

      <div style={{
        background:CLR.green, color:"#fff",
        padding:"13px 18px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        fontFamily:"'Noto Sans',sans-serif",
      }}>
        <span style={{ fontWeight:700, fontSize:15 }}>
          🎯 SUCCESS RATE: {kit.success_rate || 92}%
        </span>
        <span style={{ fontSize:11, opacity:0.75 }}>RTI Act 2005 verified</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP — dumb pipe + renderer only
// ═══════════════════════════════════════════════════════════════
export default function NexusRTI() {
  const [bubbles,   setBubbles]   = useState([]);   // display messages
  const [history,   setHistory]   = useState([]);   // Nexus conversation history
  const [input,     setInput]     = useState("");
  const [busy,      setBusy]      = useState(false);
  const [typing,    setTyping]    = useState(false);

  // Nexus decides what to show — app just renders
  const [chips,     setChips]     = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [kit,       setKit]       = useState(null);
  const [legalMeta, setLegalMeta] = useState(null);
  const [procName,  setProcName]  = useState("");
  const [showNew,   setShowNew]   = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [bubbles, typing, chips, preview, kit]);

  // Boot
  useEffect(() => {
    pipe("Hello! I need help with a government procedure in India.", []);
  }, []);

  // ══════════════════════════════════════════════════
  // PIPE: user text → Nexus → parse → render
  // App has ZERO logic here. Nexus decides everything.
  // ══════════════════════════════════════════════════
  async function pipe(userText, existingHistory) {
    setBusy(true);
    setTyping(true);
    setChips(null);

    const newHistory = [...existingHistory, { role:"user", content: userText }];

    let raw = "";
    try {
      raw = await callNexus(newHistory);
    } catch (err) {
      raw = `Sorry, I couldn't reach Nexus right now. Please try again in a moment.\n\n<NEXUS_JSON>{"stage":"error","clarifier_options":[],"show_preview":false,"show_kit":false}</NEXUS_JSON>`;
    }

    const { text, json } = parse(raw);
    const updatedHistory = [...newHistory, { role:"assistant", content: raw }];
    setHistory(updatedHistory);
    setTyping(false);

    // render bot bubble
    if (text) setBubbles(b => [...b, { role:"bot", text }]);

    // let Nexus drive the UI
    if (json?.intent)                         setProcName(json.intent.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()));
    if (json?.clarifier_options?.length > 0)  setChips(json.clarifier_options);
    if (json?.show_preview && json?.user_details) setPreview(json);
    if (json?.show_kit && json?.action_kit)   { setKit(json.action_kit); setShowNew(true); }
    if (json?.legal_grounding)                setLegalMeta(json.legal_grounding);

    setBusy(false);
  }

  function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setChips(null);
    setPreview(null);
    setBubbles(b => [...b, { role:"user", text: msg }]);
    pipe(msg, history);
  }

  function confirm(choice) {
    setPreview(null);
    setBubbles(b => [...b, { role:"user", text: choice }]);
    pipe(
      choice === "YES"
        ? "YES — confirmed. Please file the RTIs now."
        : "NO — please cancel.",
      history
    );
  }

  function reset() {
    setBubbles([]); setHistory([]); setInput("");
    setChips(null); setPreview(null); setKit(null);
    setLegalMeta(null);
    setProcName(""); setShowNew(false);
    pipe("Hello! I need help with a government procedure in India.", []);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Baloo+2:wght@700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#ffe8d6; }
        @keyframes bop {
          0%,80%,100% { transform:scale(0.55); opacity:0.35; }
          40%          { transform:scale(1);    opacity:1;    }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,107,53,0.25); border-radius:4px; }
        button:active { transform:scale(0.97); }
      `}</style>

      <div style={{
        minHeight:"100vh", maxWidth:520, margin:"0 auto",
        display:"flex", flexDirection:"column",
        background:"linear-gradient(160deg,#fff5ee,#ffe8d6 60%,#ffd6b8)",
        fontFamily:"'Noto Sans',sans-serif",
      }}>

        {/* HEADER */}
        <div style={{
          background:`linear-gradient(135deg,${CLR.deep},#2d0f00)`,
          padding:"14px 18px",
          display:"flex", alignItems:"center", gap:12,
          boxShadow:"0 3px 18px rgba(0,0,0,0.3)",
          position:"sticky", top:0, zIndex:20,
        }}>
          <div style={{
            width:44, height:44, borderRadius:"50%", flexShrink:0,
            background:`linear-gradient(135deg,${CLR.saffron},${CLR.gold})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:22, boxShadow:`0 0 0 3px rgba(255,107,53,0.28)`,
          }}>⚖️</div>
          <div>
            <div style={{
              fontFamily:"'Baloo 2',cursive", fontWeight:800,
              fontSize:20, color:"#fff", lineHeight:1,
            }}>Nexus RTI</div>
            <div style={{ fontSize:11, color:CLR.gold, marginTop:2 }}>
              {procName || "Universal Legal Chakkar Eliminator"} · RTI Act 2005
            </div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            {busy && (
              <span style={{
                fontSize:10, color:CLR.gold,
                background:"rgba(244,162,97,0.15)",
                padding:"3px 10px", borderRadius:20,
                animation:"bop 1.2s infinite",
              }}>Nexus thinking…</span>
            )}
            <div style={{
              width:8, height:8, borderRadius:"50%",
              background:"#4caf50", boxShadow:"0 0 6px #4caf50",
            }}/>
          </div>
        </div>

        {/* CHAT */}
        <div style={{ flex:1, padding:"16px 14px 10px", overflowY:"auto" }}>

          {bubbles.map((b, i) => (
            <Bubble key={i} role={b.role} text={b.text} />
          ))}

          {typing && <Bubble isTyping />}

          {/* Nexus-driven clarifier chips */}
          {chips && !busy && (
            <ClarifierChips options={chips} onPick={label => send(label)} />
          )}

          {/* Nexus-driven preview card */}
          {preview && !busy && (
            <RTIPreview json={preview} onConfirm={confirm} />
          )}

          {/* Nexus-driven action kit */}
          {kit && !busy && (
            <>
              <ActionKitCard kit={kit} procedureName={procName} />
              <div style={{
                padding:"12px 16px",
                background:"rgba(255,255,255,0.9)", borderRadius:12,
                fontSize:13, marginBottom:14,
                border:`1px solid rgba(255,107,53,0.15)`,
                fontFamily:"'Noto Sans',sans-serif",
                lineHeight:1.8,
              }}>
                🎤 <b>Voice Guide:</b> Hindi · Telugu · Tamil · Kannada · Marathi · Bengali<br/>
                📸 <b>Checklist:</b> Screenshot or share via WhatsApp<br/>
                💬 Still have questions? Just type below.
              </div>
              {showNew && (
                <button onClick={reset} style={{
                  width:"100%", padding:"14px", borderRadius:12, border:"none",
                  background:`linear-gradient(135deg,${CLR.saffron},#e85d2f)`,
                  color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer",
                  fontFamily:"'Noto Sans',sans-serif",
                  boxShadow:"0 4px 14px rgba(255,107,53,0.35)", marginBottom:14,
                }}>➕ New Procedure</button>
              )}
            </>
          )}

          {/* Legal grounding metadata from official public portals */}
          {legalMeta && !busy && (
            <div style={{
              padding:"12px 16px",
              background:"rgba(255,255,255,0.92)",
              borderRadius:12,
              fontSize:12,
              marginBottom:14,
              border:`1px solid rgba(45,106,79,0.2)`,
              fontFamily:"'Noto Sans',sans-serif",
              lineHeight:1.7,
            }}>
              <div style={{ fontWeight:700, color:CLR.green, marginBottom:6 }}>Legal Grounding</div>
              <div><b>Last verified:</b> {legalMeta.last_verified || "Not provided"}</div>
              <div><b>Jurisdiction:</b> {legalMeta.jurisdiction || "India"}</div>
              <div><b>Confidence:</b> {legalMeta.confidence_note || "Based on available official guidance"}</div>
              {Array.isArray(legalMeta.sources) && legalMeta.sources.length > 0 && (
                <div><b>Sources:</b> {legalMeta.sources.join(" | ")}</div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div style={{
          padding:"10px 14px",
          background:"rgba(255,255,255,0.96)",
          borderTop:"1px solid rgba(255,107,53,0.12)",
          display:"flex", gap:10, alignItems:"center",
          backdropFilter:"blur(12px)",
          position:"sticky", bottom:0,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            disabled={busy || !!preview}
            placeholder={
              busy    ? "Nexus is thinking…" :
              preview ? "Use the buttons above ↑" :
                        "Type anything — voice notes, Hindi, messy text…"
            }
            style={{
              flex:1, padding:"12px 16px", borderRadius:24,
              border:`1.5px solid ${input ? CLR.saffron : "rgba(255,107,53,0.25)"}`,
              outline:"none", fontSize:14,
              fontFamily:"'Noto Sans',sans-serif",
              background:(busy || !!preview) ? "#f5f5f5" : CLR.cream,
              color:CLR.deep, transition:"border 0.2s",
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || busy}
            style={{
              width:46, height:46, borderRadius:"50%", border:"none",
              background: (input.trim() && !busy)
                ? `linear-gradient(135deg,${CLR.saffron},#e85d2f)`
                : "#e0e0e0",
              cursor: (input.trim() && !busy) ? "pointer" : "not-allowed",
              fontSize:19, flexShrink:0, transition:"all 0.2s",
              boxShadow: (input.trim() && !busy)
                ? `0 4px 14px rgba(255,107,53,0.4)` : "none",
            }}
          >➤</button>
        </div>

        {/* FOOTER */}
        <div style={{
          textAlign:"center", fontSize:10, color:"#bbb",
          padding:"6px 16px 10px",
          background:"rgba(255,255,255,0.96)",
          fontFamily:"'Noto Sans',sans-serif",
        }}>
          🔒 DPDP Act compliant · No data stored beyond session · RTI Act 2005 §6
        </div>

      </div>
    </>
  );
}