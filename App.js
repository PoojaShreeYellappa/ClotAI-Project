import { useState, useRef, useEffect } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────
const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

const COMPATIBILITY = {
  "O-": ["A+","A-","B+","B-","AB+","AB-","O+","O-"],
  "O+": ["A+","B+","AB+","O+"],
  "A-": ["A+","A-","AB+","AB-"],
  "A+": ["A+","AB+"],
  "B-": ["B+","B-","AB+","AB-"],
  "B+": ["B+","AB+"],
  "AB-": ["AB+","AB-"],
  "AB+": ["AB+"],
};

const SLIDES = [
  { stat:"Every 2 seconds", sub:"someone in India needs blood", icon:"🩸", fact:"India needs 15 million units of blood annually, but only 11 million units are collected." },
  { stat:"Only 1%", sub:"of India's population donates blood", icon:"💉", fact:"If just 3% donated, there would be no shortage. One donation can save up to 3 lives." },
  { stat:"O- is Universal", sub:"donor for all blood types", icon:"🌍", fact:"O- donors are heroes — their blood can be given to anyone in an emergency, regardless of blood type." },
  { stat:"Every 3 months", sub:"healthy adults can donate safely", icon:"🔄", fact:"The body replenishes plasma within 24 hours and red blood cells within 4–6 weeks after donation." },
  { stat:"15 minutes", sub:"is all it takes to donate", icon:"⏱️", fact:"A single donation session takes just 15 minutes. The impact lasts a lifetime for the recipient." },
];

const MOCK_DONORS = [
  { id:1, name:"Arjun Sharma", blood:"O+", city:"Bengaluru", area:"Koramangala", lat:12.9352, lng:77.6245, phone:"9876543201", available:true, role:"donor" },
  { id:2, name:"Priya Nair", blood:"A+", city:"Bengaluru", area:"Indiranagar", lat:12.9784, lng:77.6408, phone:"9876543202", available:true, role:"donor" },
  { id:3, name:"Rahul Mehta", blood:"B+", city:"Bengaluru", area:"HSR Layout", lat:12.9116, lng:77.6474, phone:"9876543203", available:true, role:"donor" },
  { id:4, name:"Sneha Rao", blood:"O-", city:"Bengaluru", area:"Whitefield", lat:12.9698, lng:77.7499, phone:"9876543204", available:true, role:"donor" },
  { id:5, name:"Dev Iyer", blood:"AB+", city:"Bengaluru", area:"Jayanagar", lat:12.9253, lng:77.5938, phone:"9876543205", available:false, role:"donor" },
  { id:6, name:"Meera Pillai", blood:"A-", city:"Bengaluru", area:"Marathahalli", lat:12.9591, lng:77.6974, phone:"9876543206", available:true, role:"donor" },
];

const HOSPITALS = [
  { id:"h1", name:"Narayana Health", area:"HSR Layout", lat:12.9116, lng:77.6474, phone:"08071222222", stock:["O+","A+","B-","O-","AB+"] },
  { id:"h2", name:"Manipal Hospital", area:"Indiranagar", lat:12.9784, lng:77.6408, phone:"08025024444", stock:["A+","B+","O+","AB-"] },
  { id:"h3", name:"St. John's Medical", area:"Koramangala", lat:12.9352, lng:77.6245, phone:"08022065000", stock:["B+","AB+","A-","O+","O-"] },
  { id:"h4", name:"Fortis Hospital", area:"Bannerghatta", lat:12.8762, lng:77.5993, phone:"08066214444", stock:["O-","A+","B+"] },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function callClaude(messages, system) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system, messages }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text||"").join("") || "Sorry, couldn't get a response.";
}

// ─── LOCAL ELIGIBILITY CHECKER (NBTC India Rules) ─────────────────────────────
function checkEligibilityLocally(form) {
  const age = parseInt(form.age);
  const weight = parseFloat(form.weight);
  const reasons = [];
  const tips = [];
  let eligible = true;

  // --- Age check ---
  if (isNaN(age) || age < 18) {
    eligible = false;
    reasons.push("You must be at least 18 years old to donate blood in India.");
    tips.push("You can register once you turn 18!");
  } else if (age > 65) {
    eligible = false;
    reasons.push("Donors above 65 years are not eligible as per NBTC India guidelines.");
    tips.push("You can still help by encouraging others to donate.");
  }

  // --- Weight check ---
  if (isNaN(weight) || weight < 45) {
    eligible = false;
    reasons.push(`Your weight (${weight || "?"} kg) is below the minimum requirement of 45 kg.`);
    tips.push("Focus on a nutritious diet to reach a healthy weight.");
  }

  // --- Last donation gap check ---
  if (form.lastDonated && form.lastDonated.trim() !== "") {
    const lastDate = new Date(form.lastDonated);
    if (!isNaN(lastDate.getTime())) {
      const diffDays = (new Date() - lastDate) / (1000 * 60 * 60 * 24);
      if (diffDays < 90) {
        eligible = false;
        const remaining = Math.ceil(90 - diffDays);
        reasons.push(`You donated recently. A minimum gap of 90 days (3 months) is required between donations. You need to wait ${remaining} more day(s).`);
        tips.push("Your body needs time to replenish red blood cells fully.");
      }
    }
  }

  // --- Disqualifying conditions ---
  if (form.recentSurgery === "yes") {
    eligible = false;
    reasons.push("You had surgery in the last 6 months. You need to wait at least 6 months after any major surgery.");
    tips.push("Once fully recovered (6+ months post-surgery), you can donate again.");
  }

  if (form.recentTattoo === "yes") {
    eligible = false;
    reasons.push("You had a tattoo or piercing recently. A 12-month deferral is required after tattoos or piercings.");
    tips.push("After 12 months from your tattoo/piercing date, you'll be eligible again.");
  }

  if (form.medications === "yes") {
    eligible = false;
    reasons.push("You are currently on medications. Eligibility depends on the specific medication — some require a deferral period.");
    tips.push("Consult a blood bank staff member with your medication list to confirm eligibility.");
  }

  if (form.pregnancy === "yes") {
    eligible = false;
    reasons.push("You are pregnant or were recently pregnant. A 6-month deferral is required after delivery or breastfeeding ends.");
    tips.push("After 6 months post-delivery and once breastfeeding is complete, you may donate.");
  }

  if (form.diabetes === "yes") {
    eligible = false;
    reasons.push("Donors with diabetes on insulin are not eligible. Diabetics on oral medication may donate if well-controlled — confirm at the blood bank.");
    tips.push("Visit a blood bank directly for a clinical assessment if your diabetes is diet- or tablet-controlled.");
  }

  // --- All good ---
  if (eligible) {
    reasons.push("Age is within the valid range (18–65 years) ✓");
    reasons.push(`Weight (${weight} kg) meets the minimum requirement of 45 kg ✓`);
    reasons.push("No disqualifying conditions detected ✓");
    tips.push("Stay well hydrated (drink plenty of water before donating).");
    tips.push("Eat an iron-rich meal (spinach, lentils, eggs) a few hours before donation.");
    tips.push("Get a good night's sleep before your donation day.");
  }

  const waitTime = eligible
    ? "You can donate right now! 🎉"
    : reasons.some(r => r.includes("day(s)"))
      ? `Please wait ${reasons.find(r => r.includes("day(s)"))?.match(/(\d+) more day/)?.[1] || "some"} more days.`
      : "Check individual conditions above for your wait period.";

  const verdict = eligible
    ? "You meet all NBTC India criteria. You're ready to be a hero!"
    : "One or more conditions prevent donation right now. See details below.";

  return { eligible, verdict, reasons, tips, waitTime };
}

// ─── SMS SIMULATION ───────────────────────────────────────────────────────────
function SMSModal({ alerts, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#0f0505", border:"1px solid rgba(220,38,38,0.4)", borderRadius:"20px", maxWidth:"560px", width:"100%", maxHeight:"80vh", overflow:"auto" }}>
        <div style={{ padding:"1.5rem 1.5rem 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#f87171", fontSize:"1.4rem" }}>📲 SMS Alerts Dispatched</h3>
            <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", marginTop:"4px" }}>Simulated — in production, these go via Twilio/MSG91</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"#9ca3af", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", fontSize:"1rem" }}>✕</button>
        </div>
        <div style={{ padding:"1rem 1.5rem 1.5rem", display:"flex", flexDirection:"column", gap:"0.8rem" }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${a.type==="hospital" ? "rgba(59,130,246,0.35)" : "rgba(220,38,38,0.25)"}`, borderRadius:"12px", padding:"1rem" }}>
              <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"6px" }}>
                <span style={{ fontSize:"1.1rem" }}>{a.type==="hospital" ? "🏥" : "🩸"}</span>
                <span style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:"0.88rem" }}>{a.to}</span>
                <span style={{ marginLeft:"auto", fontSize:"0.65rem", padding:"2px 8px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif",
                  background: a.type==="hospital" ? "rgba(59,130,246,0.15)" : "rgba(220,38,38,0.15)",
                  color: a.type==="hospital" ? "#60a5fa" : "#f87171",
                  border: `1px solid ${a.type==="hospital" ? "rgba(59,130,246,0.3)" : "rgba(220,38,38,0.3)"}` }}>
                  {a.type==="hospital" ? "HOSPITAL" : "DONOR"} · {a.dist}
                </span>
              </div>
              <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:"8px", padding:"8px 12px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", color:"#d1d5db", lineHeight:1.6, borderLeft:"3px solid rgba(220,38,38,0.4)" }}>
                {a.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SLIDESHOW ────────────────────────────────────────────────────────────────
function Slideshow() {
  const [cur, setCur] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const t = setInterval(() => next(), 4500);
    return () => clearInterval(t);
  }, [cur]);

  const next = () => {
    setAnimating(true);
    setTimeout(() => { setCur(c => (c+1)%SLIDES.length); setAnimating(false); }, 350);
  };
  const prev = () => {
    setAnimating(true);
    setTimeout(() => { setCur(c => (c-1+SLIDES.length)%SLIDES.length); setAnimating(false); }, 350);
  };

  const s = SLIDES[cur];
  return (
    <div style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"20px", padding:"2.5rem 2rem", margin:"2rem 0", position:"relative", overflow:"hidden", minHeight:"200px" }}>
      <div style={{ position:"absolute", top:0, right:0, width:"200px", height:"200px", background:"radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ opacity: animating ? 0 : 1, transition:"opacity 0.35s ease", textAlign:"center" }}>
        <div style={{ fontSize:"3rem", marginBottom:"0.5rem" }}>{s.icon}</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(1.8rem,4vw,2.8rem)", color:"#f87171", fontWeight:700, lineHeight:1.1 }}>{s.stat}</div>
        <div style={{ color:"#e5e7eb", fontFamily:"'DM Sans',sans-serif", fontSize:"1.05rem", margin:"0.4rem 0 1rem" }}>{s.sub}</div>
        <div style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", maxWidth:"480px", margin:"0 auto", lineHeight:1.6 }}>{s.fact}</div>
      </div>
      <div style={{ display:"flex", justifyContent:"center", gap:"0.5rem", marginTop:"1.5rem", alignItems:"center" }}>
        <button onClick={prev} style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", fontSize:"0.9rem" }}>‹</button>
        {SLIDES.map((_,i) => (
          <div key={i} onClick={() => setCur(i)} style={{ width: i===cur ? "24px" : "8px", height:"8px", borderRadius:"4px", background: i===cur ? "#dc2626" : "rgba(220,38,38,0.25)", cursor:"pointer", transition:"all 0.3s" }} />
        ))}
        <button onClick={next} style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", fontSize:"0.9rem" }}>›</button>
      </div>
    </div>
  );
}

// ─── REGISTRATION ─────────────────────────────────────────────────────────────
function Register({ onRegister }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [form, setForm] = useState({ name:"", phone:"", age:"", blood:"", city:"Bengaluru", area:"", lat:"12.9716", lng:"77.5946" });
  const [loading, setLoading] = useState(false);

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));

  const submit = async () => {
    if (!form.name || !form.phone || !form.blood) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    const user = { ...form, role, id: Date.now(), available: true, lat: parseFloat(form.lat), lng: parseFloat(form.lng) };
    onRegister(user);
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", position:"relative" }}>
      <div style={{ position:"absolute", top:"20%", left:"5%", width:"400px", height:"400px", background:"radial-gradient(circle, rgba(220,38,38,0.1) 0%, transparent 70%)", borderRadius:"50%", filter:"blur(60px)", pointerEvents:"none" }} />
      <div style={{ maxWidth:"520px", width:"100%", position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:"0.5rem" }}>🩸</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"2.2rem", color:"#fff", fontWeight:700 }}>
            Join <span style={{ color:"#f87171" }}>Clot AI</span>
          </h1>
          <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginTop:"6px" }}>Creating a smarter blood donation network</p>
        </div>

        {step === 1 && (
          <div>
            <p style={{ color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", textAlign:"center", marginBottom:"1.5rem", fontSize:"0.9rem" }}>I am here to...</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              {[
                { r:"donor", icon:"💉", title:"Donate Blood", desc:"I want to register as a donor and help save lives" },
                { r:"recipient", icon:"🏥", title:"Find Blood / Request Donation", desc:"I or someone I know needs blood urgently" },
              ].map(({ r, icon, title, desc }) => (
                <div key={r} onClick={() => { setRole(r); setStep(2); }} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:"16px", padding:"1.4rem", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", gap:"1rem" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(220,38,38,0.6)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="rgba(220,38,38,0.25)"}>
                  <div style={{ fontSize:"2rem", width:"48px", height:"48px", background:"rgba(220,38,38,0.12)", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"1.05rem" }}>{title}</div>
                    <div style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", marginTop:"2px" }}>{desc}</div>
                  </div>
                  <span style={{ marginLeft:"auto", color:"#f87171", fontSize:"1.2rem" }}>›</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"20px", padding:"1.8rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"1.5rem" }}>
              <button onClick={() => setStep(1)} style={{ background:"rgba(255,255,255,0.07)", border:"none", color:"#9ca3af", width:"28px", height:"28px", borderRadius:"50%", cursor:"pointer", fontSize:"0.8rem" }}>‹</button>
              <span style={{ color:"#f87171", fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", fontWeight:600 }}>
                {role === "donor" ? "💉 Registering as Donor" : "🏥 Registering as Blood Seeker"}
              </span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              {[
                { label:"FULL NAME", key:"name", placeholder:"Your name" },
                { label:"PHONE NUMBER", key:"phone", placeholder:"10-digit mobile number" },
                { label:"AGE", key:"age", placeholder:"Your age", type:"number" },
              ].map(({ label, key, placeholder, type="text" }) => (
                <div key={key}>
                  <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.2)", color:"#fff", padding:"10px 14px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
              <div>
                <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>BLOOD TYPE</label>
                <select value={form.blood} onChange={e => set("blood", e.target.value)} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.2)", color: form.blood ? "#fff" : "#4b5563", padding:"10px 14px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", outline:"none" }}>
                  <option value="">Select blood type</option>
                  {BLOOD_TYPES.map(b => <option key={b} value={b} style={{ background:"#1a0000" }}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>AREA IN BENGALURU</label>
                <input value={form.area} onChange={e => set("area", e.target.value)} placeholder="e.g. Koramangala, Indiranagar..." style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.2)", color:"#fff", padding:"10px 14px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" }} />
              </div>
              <button onClick={submit} disabled={loading || !form.name || !form.phone || !form.blood} style={{ background:"linear-gradient(135deg, #dc2626, #b91c1c)", color:"#fff", border:"none", padding:"13px", borderRadius:"12px", fontSize:"1rem", fontWeight:700, cursor: loading||!form.name||!form.phone||!form.blood ? "not-allowed" : "pointer", fontFamily:"'DM Sans',sans-serif", opacity: !form.name||!form.phone||!form.blood ? 0.5 : 1, marginTop:"0.5rem", letterSpacing:"0.02em" }}>
                {loading ? "Creating Account..." : "🩸 Join Clot AI"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ active, setActive, user, onLogout }) {
  const tabs = user?.role === "donor"
    ? ["Home","Eligibility","AI Assistant"]
    : ["Home","Find Donors","Blood Banks","AI Assistant"];

  return (
    <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"rgba(10,0,0,0.88)", backdropFilter:"blur(14px)", borderBottom:"1px solid rgba(220,38,38,0.2)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", height:"60px", gap:"1rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
        <span style={{ fontSize:"1.4rem" }}>🩸</span>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", color:"#f87171", fontWeight:700 }}>Clot AI</span>
      </div>
      <div style={{ display:"flex", gap:"0.2rem", flexWrap:"wrap" }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActive(tab)} style={{ background: active===tab ? "rgba(220,38,38,0.18)" : "transparent", border: active===tab ? "1px solid rgba(220,38,38,0.45)" : "1px solid transparent", color: active===tab ? "#f87171" : "#9ca3af", padding:"5px 12px", borderRadius:"8px", cursor:"pointer", fontSize:"0.75rem", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:600 }}>{user?.name}</div>
          <div style={{ color:"#f87171", fontFamily:"'DM Sans',sans-serif", fontSize:"0.65rem" }}>{user?.blood} · {user?.role === "donor" ? "Donor" : "Seeking"}</div>
        </div>
        <button onClick={onLogout} style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#6b7280", padding:"5px 10px", borderRadius:"8px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"0.72rem" }}>Logout</button>
      </div>
    </nav>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function Home({ user, setActive }) {
  return (
    <div style={{ padding:"2rem", maxWidth:"820px", margin:"0 auto" }}>
      <div style={{ marginBottom:"1.5rem" }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(2rem,5vw,3rem)", color:"#fff", lineHeight:1.15 }}>
          Welcome back,<br /><span style={{ color:"#f87171" }}>{user.name.split(" ")[0]}</span> 👋
        </h1>
        <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginTop:"8px" }}>
          {user.role === "donor" ? "You're registered as a blood donor. Check your eligibility or chat with our AI assistant." : "You're registered as a blood seeker. Find compatible donors or nearby blood banks."}
        </p>
      </div>
      <Slideshow />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"1rem", marginTop:"1.5rem" }}>
        {(user.role === "donor"
          ? [
              { icon:"✅", label:"Check Eligibility", desc:"See if you can donate today", tab:"Eligibility", color:"#4ade80" },
              { icon:"🤖", label:"AI Assistant", desc:"Ask anything about blood donation", tab:"AI Assistant", color:"#60a5fa" },
            ]
          : [
              { icon:"🔍", label:"Find Donors", desc:"Search compatible blood donors nearby", tab:"Find Donors", color:"#f87171" },
              { icon:"🏥", label:"Blood Banks", desc:"Locate blood banks with live stock", tab:"Blood Banks", color:"#fb923c" },
              { icon:"🤖", label:"AI Assistant", desc:"Ask anything about blood donation", tab:"AI Assistant", color:"#60a5fa" },
            ]
        ).map(({ icon, label, desc, tab, color }) => (
          <div key={tab} onClick={() => setActive(tab)} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"14px", padding:"1.2rem", cursor:"pointer", transition:"border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor=`${color}55`}
            onMouseLeave={e => e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
            <div style={{ fontSize:"1.8rem", marginBottom:"0.6rem" }}>{icon}</div>
            <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"0.95rem" }}>{label}</div>
            <div style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", marginTop:"3px" }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:"1.5rem", background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"14px", padding:"1rem 1.2rem", display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ fontSize:"1.3rem" }}>📲</span>
        <div>
          <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:"0.85rem" }}>SMS Alerts Active</div>
          <div style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.75rem" }}>You'll receive an SMS if a compatible blood request is made near {user.area || "your area"}</div>
        </div>
        <div style={{ marginLeft:"auto", width:"10px", height:"10px", background:"#4ade80", borderRadius:"50%", boxShadow:"0 0 8px #4ade80" }} />
      </div>
    </div>
  );
}

// ─── FIND DONORS ──────────────────────────────────────────────────────────────
function FindDonors({ user, allDonors }) {
  const [bloodNeeded, setBloodNeeded] = useState("");
  const [radius, setRadius] = useState(10);
  const [results, setResults] = useState(null);
  const [smsAlerts, setSmsAlerts] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!bloodNeeded) return;
    setLoading(true);
    const compatTypes = Object.entries(COMPATIBILITY)
      .filter(([donor]) => COMPATIBILITY[donor].includes(bloodNeeded))
      .map(([donor]) => donor);
    const patientLat = user.lat || 12.9716;
    const patientLng = user.lng || 77.5946;
    const nearbyDonors = [...MOCK_DONORS, ...allDonors.filter(d => d.role==="donor")]
      .filter(d => compatTypes.includes(d.blood) && d.available)
      .map(d => ({ ...d, dist: haversine(patientLat, patientLng, d.lat||12.9716, d.lng||77.5946) }))
      .filter(d => d.dist <= radius)
      .sort((a,b) => a.dist - b.dist);
    const nearbyHospitals = HOSPITALS
      .filter(h => h.stock.some(t => compatTypes.includes(t)))
      .map(h => ({ ...h, dist: haversine(patientLat, patientLng, h.lat, h.lng) }))
      .filter(h => h.dist <= radius)
      .sort((a,b) => a.dist - b.dist);
    setResults({ donors: nearbyDonors, hospitals: nearbyHospitals, bloodNeeded });
    const alerts = [
      ...nearbyDonors.map(d => ({ type:"donor", to:`${d.name} (${d.phone})`, dist:`${d.dist.toFixed(1)} km`, message:`[Clot AI] URGENT: A patient near ${user.area||"your area"} needs ${bloodNeeded} blood. You are a compatible ${d.blood} donor. Please respond ASAP. Reply YES to confirm. Helpline: 1800-XXX-XXXX` })),
      ...nearbyHospitals.map(h => ({ type:"hospital", to:`${h.name} Blood Bank (${h.phone})`, dist:`${h.dist.toFixed(1)} km`, message:`[Clot AI] ALERT: Patient near ${user.area||"Bengaluru"} requires ${bloodNeeded} blood. Your hospital has compatible stock. Please confirm availability at ${h.phone}. Reply CONFIRM to coordinate.` }))
    ];
    await new Promise(r => setTimeout(r, 600));
    setSmsAlerts(alerts);
    setLoading(false);
  };

  return (
    <div style={{ padding:"2rem", maxWidth:"900px", margin:"0 auto" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#f87171", fontSize:"2rem", marginBottom:"0.3rem" }}>Find Blood Donors</h2>
      <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginBottom:"1.5rem" }}>Search nearby donors + auto-alert via SMS</p>
      <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", marginBottom:"1.5rem", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"14px", padding:"1.2rem" }}>
        <div style={{ flex:1, minWidth:"160px" }}>
          <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>BLOOD TYPE NEEDED</label>
          <select value={bloodNeeded} onChange={e => setBloodNeeded(e.target.value)} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.25)", color: bloodNeeded ? "#fff" : "#4b5563", padding:"10px 14px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem" }}>
            <option value="">Select type</option>
            {BLOOD_TYPES.map(b => <option key={b} value={b} style={{ background:"#1a0000" }}>{b}</option>)}
          </select>
        </div>
        <div style={{ flex:1, minWidth:"160px" }}>
          <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>SEARCH RADIUS: {radius} KM</label>
          <input type="range" min={2} max={30} value={radius} onChange={e => setRadius(+e.target.value)} style={{ width:"100%", marginTop:"8px", accentColor:"#dc2626" }} />
        </div>
        <div style={{ display:"flex", alignItems:"flex-end" }}>
          <button onClick={search} disabled={!bloodNeeded || loading} style={{ background:"linear-gradient(135deg,#dc2626,#b91c1c)", color:"#fff", border:"none", padding:"10px 22px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontWeight:700, cursor: !bloodNeeded||loading ? "not-allowed" : "pointer", opacity: !bloodNeeded ? 0.5 : 1, fontSize:"0.9rem" }}>
            {loading ? "Searching..." : "🔍 Search & Alert"}
          </button>
        </div>
      </div>
      {results && (
        <div>
          <div style={{ display:"flex", gap:"1rem", marginBottom:"1rem", flexWrap:"wrap" }}>
            <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:"10px", padding:"8px 16px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#f87171" }}>🩸 {results.donors.length} donor{results.donors.length!==1?"s":""} found</div>
            <div style={{ background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.25)", borderRadius:"10px", padding:"8px 16px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#60a5fa" }}>🏥 {results.hospitals.length} hospital{results.hospitals.length!==1?"s":""} with stock</div>
            {smsAlerts && <button onClick={() => setSmsAlerts(smsAlerts)} style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:"10px", padding:"8px 16px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#4ade80", cursor:"pointer" }}>📲 View {smsAlerts.length} SMS Alerts Sent</button>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:"1rem" }}>
            {results.donors.map((d,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:"14px", padding:"1.1rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"0.6rem" }}>
                  <div style={{ width:"40px", height:"40px", background:"rgba(220,38,38,0.15)", border:"2px solid rgba(220,38,38,0.4)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Playfair Display',serif", color:"#f87171", fontWeight:700, fontSize:"0.9rem", flexShrink:0 }}>{d.blood}</div>
                  <div>
                    <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:"0.88rem" }}>{d.name}</div>
                    <div style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.72rem" }}>{d.area} · {d.dist.toFixed(1)} km away</div>
                  </div>
                </div>
                <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:"6px", padding:"4px 10px", fontSize:"0.68rem", color:"#4ade80", fontFamily:"'DM Sans',sans-serif", display:"inline-block" }}>📲 SMS Sent</div>
              </div>
            ))}
            {results.hospitals.map((h,i) => (
              <div key={i} style={{ background:"rgba(59,130,246,0.04)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:"14px", padding:"1.1rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"0.6rem" }}>
                  <span style={{ fontSize:"1.4rem" }}>🏥</span>
                  <div>
                    <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:"0.88rem" }}>{h.name}</div>
                    <div style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.72rem" }}>{h.area} · {h.dist.toFixed(1)} km away</div>
                  </div>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"4px", marginBottom:"6px" }}>
                  {h.stock.map(t => <span key={t} style={{ fontSize:"0.65rem", padding:"2px 7px", borderRadius:"8px", background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.25)", color:"#93c5fd", fontFamily:"'DM Sans',sans-serif" }}>{t}</span>)}
                </div>
                <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:"6px", padding:"4px 10px", fontSize:"0.68rem", color:"#4ade80", fontFamily:"'DM Sans',sans-serif", display:"inline-block" }}>📲 Hospital Alerted</div>
              </div>
            ))}
          </div>
          {results.donors.length === 0 && results.hospitals.length === 0 && (
            <div style={{ textAlign:"center", padding:"2rem", color:"#6b7280", fontFamily:"'DM Sans',sans-serif" }}>No matches found within {radius} km. Try increasing the radius.</div>
          )}
        </div>
      )}
      {smsAlerts && <SMSModal alerts={smsAlerts} onClose={() => setSmsAlerts(null)} />}
    </div>
  );
}

// ─── BLOOD BANKS ──────────────────────────────────────────────────────────────
function BloodBanks() {
  const [filter, setFilter] = useState("");
  const banks = filter ? HOSPITALS.filter(b => b.stock.includes(filter)) : HOSPITALS;
  return (
    <div style={{ padding:"2rem", maxWidth:"860px", margin:"0 auto" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#f87171", fontSize:"2rem", marginBottom:"0.3rem" }}>Blood Banks</h2>
      <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginBottom:"1.5rem" }}>Hospitals near Bengaluru with blood inventory</p>
      <div style={{ marginBottom:"1.5rem" }}>
        <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>FILTER BY BLOOD TYPE IN STOCK</label>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.25)", color: filter?"#fff":"#4b5563", padding:"10px 16px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem" }}>
          <option value="">All</option>
          {BLOOD_TYPES.map(b => <option key={b} value={b} style={{ background:"#1a0000" }}>{b}</option>)}
        </select>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
        {banks.map((b,i) => (
          <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(220,38,38,0.18)", borderRadius:"14px", padding:"1.3rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"0.5rem" }}>
              <div>
                <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"1rem" }}>{b.name}</div>
                <div style={{ color:"#6b7280", fontSize:"0.78rem", fontFamily:"'DM Sans',sans-serif", marginTop:"2px" }}>📍 {b.area}, Bengaluru</div>
              </div>
              <a href={`tel:${b.phone}`} style={{ background:"rgba(220,38,38,0.12)", border:"1px solid rgba(220,38,38,0.3)", color:"#f87171", padding:"6px 14px", borderRadius:"8px", textDecoration:"none", fontSize:"0.78rem", fontFamily:"'DM Sans',sans-serif" }}>📞 Call</a>
            </div>
            <div style={{ marginTop:"0.8rem", display:"flex", flexWrap:"wrap", gap:"0.4rem" }}>
              {b.stock.map(t => <span key={t} style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.22)", borderRadius:"8px", padding:"4px 12px", color:"#f87171", fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:"0.85rem" }}>{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI ASSISTANT ─────────────────────────────────────────────────────────────
function AIAssistant({ user }) {
  const [msgs, setMsgs] = useState([
    { role:"assistant", content:`Hi ${user.name.split(" ")[0]}! I'm Clot AI 🩸 I'm here to help you with blood donation questions, the donation process, nutrition tips, and more. What would you like to know?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role:"user", content:input };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    const reply = await callClaude(newMsgs, "You are Clot AI, a warm and knowledgeable blood donation assistant for India. Help users with donation eligibility, blood types, nutrition, donation frequency, process, and FAQs. Keep responses under 150 words. Be encouraging and supportive.");
    setMsgs(p => [...p, { role:"assistant", content:reply }]);
    setLoading(false);
  };

  const suggestions = ["What to eat before donating?","How often can I donate?","Does it hurt?","Who is a universal donor?"];

  return (
    <div style={{ padding:"2rem", maxWidth:"700px", margin:"0 auto" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#f87171", fontSize:"2rem", marginBottom:"0.3rem" }}>AI Assistant</h2>
      <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginBottom:"1.5rem" }}>Ask anything about blood donation</p>
      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"16px", overflow:"hidden" }}>
        <div style={{ height:"380px", overflowY:"auto", padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
          {msgs.map((m,i) => (
            <div key={i} style={{ display:"flex", justifyContent: m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"82%", padding:"10px 14px", borderRadius: m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", background: m.role==="user"?"linear-gradient(135deg,#dc2626,#b91c1c)":"rgba(255,255,255,0.06)", border: m.role==="assistant"?"1px solid rgba(220,38,38,0.2)":"none", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:"0.87rem", lineHeight:1.6 }}>
                {m.role==="assistant" && <span style={{ fontSize:"0.7rem", color:"#f87171", display:"block", marginBottom:"3px" }}>🩸 Clot AI</span>}
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div style={{ display:"flex" }}><div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"18px 18px 18px 4px", padding:"10px 14px", color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem" }}>Thinking... 🩸</div></div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding:"0 1.2rem 0.8rem", display:"flex", flexWrap:"wrap", gap:"0.4rem" }}>
          {suggestions.map(s => <button key={s} onClick={() => setInput(s)} style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", color:"#9ca3af", padding:"4px 11px", borderRadius:"20px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem" }}>{s}</button>)}
        </div>
        <div style={{ padding:"0.8rem 1.2rem", borderTop:"1px solid rgba(220,38,38,0.15)", display:"flex", gap:"0.6rem" }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && send()} placeholder="Ask about blood donation..." style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.22)", color:"#fff", padding:"9px 14px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", outline:"none" }} />
          <button onClick={send} disabled={loading||!input.trim()} style={{ background:"linear-gradient(135deg,#dc2626,#b91c1c)", color:"#fff", border:"none", padding:"9px 18px", borderRadius:"10px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, opacity: loading||!input.trim()?0.5:1, fontSize:"0.88rem" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ─── ELIGIBILITY (FIXED — Local Rules Engine) ─────────────────────────────────
function Eligibility({ user }) {
  const [form, setForm] = useState({
    age: user.age || "",
    weight: "",
    lastDonated: "",
    recentSurgery: "no",
    recentTattoo: "no",
    medications: "no",
    pregnancy: "no",
    diabetes: "no"
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const check = () => {
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      const res = checkEligibilityLocally(form);
      setResult(res);
      setLoading(false);
    }, 700);
  };

  const Toggle = ({ label, k }) => (
    <div style={{ flex:1, minWidth:"170px" }}>
      <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.05em", display:"block", marginBottom:"5px" }}>{label}</label>
      <div style={{ display:"flex", gap:"0.4rem" }}>
        {["yes","no"].map(opt => (
          <button key={opt} onClick={() => set(k, opt)} style={{ flex:1, padding:"9px", borderRadius:"8px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", fontWeight:600,
            background: form[k]===opt ? (opt==="yes"?"rgba(239,68,68,0.18)":"rgba(34,197,94,0.13)") : "rgba(255,255,255,0.04)",
            border: form[k]===opt ? (opt==="yes"?"1px solid rgba(239,68,68,0.45)":"1px solid rgba(34,197,94,0.4)") : "1px solid rgba(255,255,255,0.1)",
            color: form[k]===opt ? (opt==="yes"?"#f87171":"#4ade80") : "#6b7280" }}>
            {opt === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding:"2rem", maxWidth:"740px", margin:"0 auto" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#f87171", fontSize:"2rem", marginBottom:"0.3rem" }}>Eligibility Checker</h2>
      <p style={{ color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginBottom:"1.5rem" }}>Rules-based · NBTC India guidelines</p>

      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"16px", padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
        {/* Basic fields */}
        <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
          {[
            ["AGE (YEARS)", "age", "number"],
            ["WEIGHT (KG)", "weight", "number"],
            ["LAST DONATION DATE", "lastDonated", "date"],
          ].map(([label, k, type]) => (
            <div key={k} style={{ flex:1, minWidth:"150px" }}>
              <label style={{ color:"#6b7280", fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em", display:"block", marginBottom:"5px" }}>{label}</label>
              <input
                type={type}
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                placeholder={k === "lastDonated" ? "Leave blank if never" : ""}
                style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(220,38,38,0.2)", color:"#fff", padding:"10px 14px", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", outline:"none", boxSizing:"border-box", colorScheme:"dark" }}
              />
            </div>
          ))}
        </div>

        {/* Toggle rows */}
        <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
          <Toggle label="RECENT SURGERY (LAST 6 MO)?" k="recentSurgery" />
          <Toggle label="RECENT TATTOO/PIERCING?" k="recentTattoo" />
          <Toggle label="ON MEDICATIONS?" k="medications" />
        </div>
        <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
          <Toggle label="PREGNANT / RECENTLY PREGNANT?" k="pregnancy" />
          <Toggle label="HAS DIABETES?" k="diabetes" />
        </div>

        <button
          onClick={check}
          disabled={!form.age || !form.weight || loading}
          style={{ background:"linear-gradient(135deg,#dc2626,#b91c1c)", color:"#fff", border:"none", padding:"12px", borderRadius:"12px", fontSize:"0.95rem", fontWeight:700, cursor: !form.age||!form.weight||loading ? "not-allowed" : "pointer", fontFamily:"'DM Sans',sans-serif", opacity: !form.age||!form.weight ? 0.5 : 1 }}>
          {loading ? "Checking..." : "✅ Check My Eligibility"}
        </button>
      </div>

      {/* Result card */}
      {result && (
        <div style={{ marginTop:"1.5rem", background: result.eligible ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border:`1px solid ${result.eligible ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius:"16px", padding:"1.4rem" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"1rem" }}>
            <div style={{ fontSize:"2.5rem" }}>{result.eligible ? "✅" : "❌"}</div>
            <div>
              <div style={{ color: result.eligible ? "#4ade80" : "#f87171", fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700 }}>
                {result.eligible ? "You're Eligible to Donate!" : "Not Eligible Right Now"}
              </div>
              <div style={{ color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", marginTop:"2px" }}>{result.verdict}</div>
            </div>
          </div>

          {/* Wait time badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background: result.eligible ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border:`1px solid ${result.eligible ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius:"8px", padding:"6px 14px", marginBottom:"1rem" }}>
            <span style={{ fontSize:"0.9rem" }}>⏰</span>
            <span style={{ color: result.eligible ? "#4ade80" : "#f87171", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", fontWeight:600 }}>{result.waitTime}</span>
          </div>

          {/* Reasons */}
          <div style={{ marginBottom:"0.8rem" }}>
            <div style={{ color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", fontSize:"0.72rem", letterSpacing:"0.06em", marginBottom:"0.5rem" }}>
              {result.eligible ? "WHY YOU'RE ELIGIBLE" : "REASONS FOR DEFERRAL"}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {result.reasons.map((r, i) => (
                <div key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start", background:"rgba(255,255,255,0.03)", borderRadius:"8px", padding:"8px 12px" }}>
                  <span style={{ fontSize:"0.85rem", flexShrink:0 }}>{result.eligible ? "✓" : "⚠️"}</span>
                  <span style={{ color: result.eligible ? "#86efac" : "#fca5a5", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", lineHeight:1.5 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {result.tips?.length > 0 && (
            <div style={{ marginTop:"0.8rem" }}>
              <div style={{ color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", fontSize:"0.72rem", letterSpacing:"0.06em", marginBottom:"0.5rem" }}>TIPS</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                {result.tips.map((t, i) => (
                  <div key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                    <span style={{ fontSize:"0.85rem" }}>💡</span>
                    <span style={{ color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", fontSize:"0.79rem", lineHeight:1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ marginTop:"1rem", background:"rgba(255,255,255,0.04)", borderRadius:"8px", padding:"8px 12px", color:"#6b7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem" }}>
            ⚠️ This is a self-assessment tool only. A blood bank staff member will do a final clinical check before your donation.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState("Home");
  const [extraDonors, setExtraDonors] = useState([]);

  const handleRegister = (u) => {
    setUser(u);
    if (u.role === "donor") setExtraDonors(p => [...p, u]);
    setActive("Home");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#080000;color:#fff;}
        select option{background:#1a0000;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(220,38,38,0.3);border-radius:2px;}
        input::placeholder,select::placeholder{color:#4b5563;}
        input[type=range]{height:4px;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
      `}</style>
      <div style={{ background:"#080000", minHeight:"100vh" }}>
        {!user ? (
          <Register onRegister={handleRegister} />
        ) : (
          <>
            <Navbar active={active} setActive={setActive} user={user} onLogout={() => { setUser(null); setActive("Home"); }} />
            <div style={{ paddingTop:"60px" }}>
              {active === "Home" && <Home user={user} setActive={setActive} />}
              {active === "Find Donors" && <FindDonors user={user} allDonors={extraDonors} />}
              {active === "Blood Banks" && <BloodBanks />}
              {active === "AI Assistant" && <AIAssistant user={user} />}
              {active === "Eligibility" && <Eligibility user={user} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}
