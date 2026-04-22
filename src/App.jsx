import { useState, useRef, useEffect } from "react";
import "./App.css";
import jsPDF from "jspdf";
import { Menu, Send, Play, Square, Trash2, FileText, History, Moon, ArrowLeft } from "lucide-react";

function App() {
  // ---------- STATES ----------
  const [manualInput, setManualInput] = useState("");
  const [liveText, setLiveText] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState([]);
  const [mode, setMode] = useState("Daily Standup");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const isManuallyStopped = useRef(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [typedTranscript, setTypedTranscript] = useState("");
  const [page, setPage] = useState("main"); // "main" | "history" | "results" | "actions" | "about"
  const [sidebarView, setSidebarView] = useState("main"); // "main" | "settings"
  const [history, setHistory] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMenu, setShowMenu] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const [volume, setVolume] = useState(0);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const chatRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const speechBufferRef = useRef("");
  const lastSpeechTimeRef = useRef(Date.now());
  const [textSize, setTextSize] = useState(16);
  const [themeColor, setThemeColor] = useState("blue");
  const [fontFamily, setFontFamily] = useState("system");
  const [isMuted, setIsMuted] = useState(false);
  const [showSizeLabel, setShowSizeLabel] = useState(false);
  const [themePreset, setThemePreset] = useState("blue");


  // ---------- AUTO SCROLL ----------
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // ---------- BODY SCROLL LOCK ----------
  useEffect(() => {
    if (isMobile && showMenu) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [showMenu, isMobile]);

  // ---------- THEME CONFIGURATION ----------
  const themeColors = {
    blue: "#1d4ed8",
    red: "#dc2626",
    green: "#16a34a",
  };

  const theme = {
    bg: darkMode ? "#0f172a" : "#f3f4f6",
    sidebar: darkMode ? "#111827" : "#ffffff",
    card: darkMode ? "#1f2937" : "#ffffff",
    text: darkMode ? "#f9fafb" : "#111827",

    primary: themeColors[themeColor],

    // 🎨 Botlhale Village Brand Colors
    primary: "#1d4ed8",   // BLUE
    secondary: "#ef4444", // RED
    accent: "#ffffff",    // WHITE

    success: "#16a34a",
    warning: "#f59e0b",
    danger: "#dc2626",

    border: darkMode ? "#374151" : "#e5e7eb",
  };

  // ---------- SPEECH RECOGNITION & AUDIO ----------
  const startListening = () => {
    // 🎤 AUDIO LEVEL DETECTION
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }).then((stream) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      const updateVolume = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);

        // calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }

        const avg = sum / dataArray.length;

        if (!isMuted) {
          setVolume(avg);
        } else {
          setVolume(0);
        }; // 👈 NEW STATE

        requestAnimationFrame(updateVolume);
      };

      updateVolume();
    });

    setIsListening(true);
    isManuallyStopped.current = false;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      if (isMuted || isManuallyStopped.current) return;

      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i][0];
        const text = result.transcript;

        if (event.results[i].isFinal) {
          final += text + " ";
        } else {
          interim += text;
        }
      }

      setLiveText(interim);

      if (final && final.trim().length > 2 && volume > 25) {
        const clean = final.trim();

        // 👉 add to buffer instead of instantly sending
        speechBufferRef.current += clean + " ";
        lastSpeechTimeRef.current = Date.now();
      }
    };

    // ✅ ONLY ONE onend
    recognition.onend = () => {
      if (!isManuallyStopped.current) {
        recognition.start();
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  // ---------- STOP & CLEAR ----------
  const stopListening = () => {
    console.log("STOP CLICKED");

    isManuallyStopped.current = true; // 🔥 FIRST

    setIsListening(false);
    setSeconds(0);
    setVolume(0);

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null; // 🔥 stop updates
      recognitionRef.current.onend = null;    // 🔥 stop restart
      recognitionRef.current.onerror = null;

      recognitionRef.current.stop();
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    // 🔊 stop audio detection
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // OPTIONAL: clear live typing
    setLiveText("");
  };

  // FULL RESET (for logout or new meeting)
  const clearAll = () => {
    // 🔥 FULL STOP EVERYTHING

    isManuallyStopped.current = true;

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    // 🔊 stop audio analyser
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 🧹 CLEAR UI
    setIsListening(false);
    setSeconds(0);

    setMessages([]);
    setLiveText("");
    setSummary("");
    setActions([]);

    setSpeechTranscript("");
    setTypedTranscript("");
  };

  // ---------- LOCAL SUMMARIZER ----------
  const generateSummaryOnly = (text, mode) => {
    const sentences = text.split(/(?<=[.?!])\s+/);

    const keywords = {
      "Daily Standup": ["update", "progress", "done", "working"],
      "Technical Discussion": ["issue", "bug", "solution", "fix"],
      "HR / Admin": ["announcement", "policy", "meeting"]
    };

    const selected = sentences.filter((s) =>
      keywords[mode]?.some((k) => s.toLowerCase().includes(k)) ||
      s.length > 60
    );

    return selected.map((s) => "• " + s).join("\n");
  };

  // ---------- ACTION GENERATOR ----------
  const generateActionsOnly = (text) => {
    const sentences = text.split(/(?<=[.?!])\s+/);

    const actionKeywords = ["will", "must", "should", "plan", "next", "todo"];

    const selected = sentences.filter((s) =>
      actionKeywords.some((k) => s.toLowerCase().includes(k))
    );

    return selected.map((s, i) => ({
      id: i,
      text: s,
      done: false, // 👈 checkbox state
    }));
  };

  //---------- SUMMARY ----------
  const handleSummaryOnly = () => {
    const combinedText = speechTranscript + " " + typedTranscript;

    const result = generateSummaryOnly(combinedText, mode);
    setSummary(result || "No summary available");

    // ✅ UPDATE LAST MEETING
    setHistory((prev) => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0].summary = result;
      }
      localStorage.setItem("meetingHistory", JSON.stringify(updated));
      return updated;
    });
  };

  // ---------- ACTIONS ----------
  const handleActionsOnly = () => {
    const combinedText = speechTranscript + " " + typedTranscript;

    const result = generateActionsOnly(combinedText);
    setActions(result);

    // ✅ UPDATE LAST MEETING
    setHistory((prev) => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0].actions = result;
      }
      localStorage.setItem("meetingHistory", JSON.stringify(updated));
      return updated;
    });
  };

  // ---------- TOGGLE ACTION DONE ----------
  const toggleAction = (id) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, done: !a.done } : a
      )
    );
  };

  // ---------- ADD MANUAL MESSAGE ----------
  const addManualMessage = () => {
    if (!manualInput.trim()) return;

    const clean = manualInput.trim();

    setTypedTranscript((prev) => prev + clean + " ");

    setMessages((prev) => [
      ...prev,
      {
        text: clean,
        time: new Date().toLocaleTimeString(),
        sender: "user",
      },
    ]);

    setManualInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "19px"; // reset to 1 line
    }
  };

  // ---------- PDF EXPORT ----------
  const exportPDF = () => {
    const logo = "/botlhale-logo.png";
    const doc = new jsPDF();

    try {
      doc.addImage(logo, "PNG", 10, 10, 25, 25);
    } catch (e) {
      console.log("Logo failed to load");
    }

    let y = 15;
    const pageHeight = 280;

    const checkPageBreak = (neededSpace = 10) => {
      if (y + neededSpace > pageHeight) {
        doc.addPage();
        y = 15;
      }
    };
    const addHeading = (text) => {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(text, 10, y);
      y += 7;

      doc.setDrawColor(200);
      doc.line(10, y, 200, y);
      y += 8;

      doc.setFont("helvetica", "normal");
    };

    // ---------- HEADER LAYOUT ----------

    const pageWidth = doc.internal.pageSize.getWidth();

    const imgWidth = 25;
    const imgHeight = 25;

    // ---------- TITLE (center) ----------
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("MEETING REPORT", pageWidth / 2, 18, { align: "center" });

    // ---------- COMPANY NAME (under title) ----------
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Botlhale Village Tech Hub", pageWidth / 2, 26, { align: "center" });

    // ---------- MEETING INFO (under company name) ----------
    const meetingId = "MTG-001"; // replace dynamically later
    const timeNow = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    doc.setFontSize(10);
    doc.text(`Meeting ID: ${meetingId}   |   Time: ${timeNow}`, pageWidth / 2, 34, {
      align: "center",
    });

    // ---------- DATE (right side) ----------
    const today = new Date().toLocaleDateString();

    doc.setFontSize(11);
    doc.text(`Date: ${today}`, pageWidth - 10, 18, { align: "right" });

    // ---------- LINE SEPARATOR ----------
    doc.setDrawColor(180);
    doc.line(10, 40, pageWidth - 10, 40);

    // ---------- START CONTENT ----------
    y = 50;
    // ---------- TRANSCRIPT ----------
    checkPageBreak();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    addHeading("Transcript");

    y += 7;
    doc.setFont("helvetica", "normal");

    let fullTranscript = "";

    if (speechTranscript) {
      fullTranscript += "Speech:\n" + speechTranscript + "\n\n";
    }

    if (typedTranscript) {
      fullTranscript += "Notes:\n" + typedTranscript;
    }

    if (!fullTranscript) {
      fullTranscript = "No transcript available";
    }

    const t = doc.splitTextToSize(fullTranscript, 170);

    t.forEach((line) => {
      checkPageBreak(6);
      doc.text(line, 12, y);
      y += 6;
    });

    y += 5;

    // ---------- SUMMARY ----------
    checkPageBreak();
    doc.setFontSize(14);
    doc.text("Summary", 10, y);
    y += 7;

    doc.setFontSize(10);
    const s = doc.splitTextToSize(summary || "N/A", 180);

    s.forEach((line) => {
      checkPageBreak(6);
      doc.text(line, 10, y);
      y += 6;
    });

    y += 5;

    // ---------- ACTIONS ----------
    checkPageBreak();
    doc.setFontSize(12);
    doc.text("Action Items", 10, y);
    y += 7;

    const actionText =
      actions.length > 0
        ? actions.map(a => `- ${a.text}`).join("\n")
        : "N/A";

    const a = doc.splitTextToSize(actionText, 180);

    a.forEach((line) => {
      checkPageBreak(6);
      doc.text(line, 10, y);
      y += 6;
    });

    // ---------- PAGE NUMBERS ----------
    const addPageNumbers = () => {
      const pageCount = doc.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(
          `Page ${i} of ${pageCount}`,
          105,
          287,
          null,
          null,
          "center"
        );
      }
    };

    // ---------- FOOTER ----------
    doc.setFontSize(9);
    doc.text("Generated by Smart Meeting Tool", 105, 280, null, null, "center");

    addPageNumbers();
    doc.save("Meeting_Report.pdf");
  };

  // ----------UI STYLES ----------
  const buttonStyle = (color) => ({
    padding: "10px 18px",
    borderRadius: "6px",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    margin: "5px",
  });

  // ---------- CARD STYLE ----------
  const cardStyle = {
    background: theme.card,
    padding: isMobile ? "14px" : "20px", // ✅ smaller on mobile
    borderRadius: "10px",
    height: "70vh",
    transition: "background 0.4s ease, color 0.4s ease, border 0.4s ease",
  };

  // ---------- TIMER & RECORDING ----------
  useEffect(() => {
    let interval;

    if (isListening) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isListening]);

  // ---------- LOAD HISTORY & CLEANUP ----------
  useEffect(() => {
    const saved = localStorage.getItem("meetingHistory");

    if (saved) {
      const parsed = JSON.parse(saved);

      const now = Date.now();
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

      // ✅ Filter old meetings
      const filtered = parsed.filter(
        (m) => now - (m.createdAt || 0) < THIRTY_DAYS
      );

      setHistory(filtered);
      localStorage.setItem("meetingHistory", JSON.stringify(filtered));
    }
  }, []);

  // ---------- RESPONSIVENESS HANDLING ----------
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------- TIME FORMAT ----------
  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // ---------- PULSING ANIMATION ----------
  const pulseStyle = {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "red",
    animation: "pulse 1s infinite",
  };

  //  keyframes for pulsing effect
  const pulseKeyframes = `
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.6); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
`;

  // ---------- HANDLE MANUAL INPUT & AUTO-RESIZE ----------
  const handleInput = (e) => {
    setManualInput(e.target.value);

    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  // ---------- INJECT PULSE KEYFRAMES ----------
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = pulseKeyframes;
    document.head.appendChild(style);

    return () => document.head.removeChild(style);
  }, []);

  // ---------- SPEECH BUFFER CHECK ----------
  useEffect(() => {
    if (!isListening) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;

      // 👉 if user stopped speaking for 1.2s → send message
      if (
        speechBufferRef.current.trim().length > 0 &&
        timeSinceLastSpeech > 1200
      ) {
        const message = speechBufferRef.current.trim();

        setMessages((prev) => [
          ...prev,
          {
            text: message,
            time: new Date().toLocaleTimeString(),
            sender: "speaker",
          },
        ]);

        speechBufferRef.current = "";
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isListening]);

  // ---------- DARK MODE PERSISTENCE ----------
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      setDarkMode(JSON.parse(savedMode));
    }
  }, []);

  // Save dark mode preference whenever it changes
  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  // ---------- APPLY DARK MODE CLASS TO BODY ----------
  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // LOAD SETTINGS
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("appSettings"));

    if (saved) {
      setDarkMode(saved.darkMode ?? false);
      setTextSize(saved.textSize ?? 16);
      setThemeColor(saved.themeColor ?? "blue");
      setFontFamily(saved.fontFamily ?? "system");
    }
  }, []);

  // ---------- RESET SETTINGS ----------
  const resetSettings = () => {
    setDarkMode(false);
    setTextSize(16);
    setCardColor("#1f2937");
    setThemeColor("blue");
    setFontFamily("system");
  };

  // SAVE SETTINGS
  const closeMenu = () => {
    if (isMobile) setShowMenu(false);
  };

  // Whenever settings change, save to localStorage
  const applyTheme = (theme) => {
    const root = document.documentElement;
    console.log("Theme applied:", theme);

    if (theme === "blue") {
      root.style.setProperty("--bg1", "#1e315c");
      root.style.setProperty("--bg2", "#386cb9");
      root.style.setProperty("--bg3", "#38bdf8");
      root.style.setProperty("--bg4", "#0ea5e9");
    }

    if (theme === "dark") {
      root.style.setProperty("--bg1", "#0f172a");
      root.style.setProperty("--bg2", "#111827");
      root.style.setProperty("--bg3", "#1f2937");
      root.style.setProperty("--bg4", "#000000");
    }

    if (theme === "purple") {
      root.style.setProperty("--bg1", "#3b0764");
      root.style.setProperty("--bg2", "#6d28d9");
      root.style.setProperty("--bg3", "#a855f7");
      root.style.setProperty("--bg4", "#ec4899");
    }
  };

  // Load theme preset on startup
  useEffect(() => {
    const saved = localStorage.getItem("themePreset");

    if (saved) {
      applyTheme(saved);
    } else {
      applyTheme("blue"); // default theme
    }
  }, []);

  // Save theme preset whenever it changes
  useEffect(() => {
    localStorage.setItem("themePreset", themePreset);
  }, [themePreset]);

  return (
    // ---------- MAIN CONTAINER ----------
    <div className="main-container"
      style={{
        fontFamily:
          fontFamily === "system"
            ? "system-ui"
            : fontFamily === "mono"
              ? "monospace"
              : "Poppins, sans-serif",
      }}
    >

      {/* SIDEBAR */}

      {/* TOP SECTION*/}

      <div className={`sidebar ${showMenu ? "open" : ""}`}>

        <div
          className="sidebar-inner"
          style={{
            transform:
              sidebarView === "settings"
                ? "translateX(-50%)"
                : "translateX(0%)",
          }}
        >

          {/* ===== MAIN PANEL ===== */}
          <div className="sidebar-page">
            <div className="panel-top">
              <h3 className="panel-title">Meeting Panel</h3>

              <label className="panel-label">Meeting Mode</label>

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="panel-select"
              >
                <option>Daily Standup</option>
                <option>Technical Discussion</option>
                <option>HR / Admin</option>
              </select>
            </div>

            <div className="sidebar-actions">
              <button onClick={exportPDF} className="sidebar-btn btn-primary">
                <FileText size={18} /> Export PDF
              </button>

              <button
                onClick={() => {
                  handleSummaryOnly();
                  setPage("results");
                  closeMenu();
                }}
                className="sidebar-btn btn-success"
              >
                🧠 Generate Summary
              </button>

              <button
                onClick={() => {
                  handleActionsOnly();
                  setPage("actions");
                  closeMenu();
                }}
                className="sidebar-btn btn-warning"
              >
                ✅ Generate Actions
              </button>

              <button
                onClick={() => { setPage("history"); closeMenu(); }}
                className="sidebar-btn btn-gray"
              >
                <History size={18} /> History
              </button>

              <button
                onClick={() => { setSidebarView("settings") }}
                className="sidebar-btn btn-indigo"
              >
                ⚙️ Settings
              </button>

              <button
                onClick={() => { setPage("about"); setShowMenu(false); }}
                className="sidebar-btn btn-danger"
              >
                <History size={18} /> About
              </button>

            </div>
          </div>

          {/* ===== SETTINGS PANEL ===== */}
          <div className="sidebar-page">

            {/* BACK */}
            <div className="settings-header">
              <button
                onClick={() => setSidebarView("main")}
                className="back-btn"
              >
                <ArrowLeft size={18} />
              </button>
              <h3>Settings</h3>
            </div>

            {/* ===== APPEARANCE ===== */}
            <div className="settings-group">
              <h4>🎨 Appearance</h4>

              <div className="setting-item">
                <span>Dark Mode</span>

                <div
                  className={`toggle ${darkMode ? "active" : ""}`}
                  onClick={() => setDarkMode(!darkMode)}
                >
                  <div className="toggle-circle">
                    {darkMode ? "🌙" : "☀️"}
                  </div>
                </div>
              </div>

              <div className="setting-item column">

                <span>Text Size</span>

                {/* FLOATING VALUE */}
                {showSizeLabel && (
                  <div className="slider-popup">
                    {textSize}px
                  </div>
                )}

                <input
                  type="range"
                  min="12"
                  max="30"
                  step="2"
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}

                  onMouseDown={() => setShowSizeLabel(true)}
                  onMouseUp={() => setTimeout(() => setShowSizeLabel(false), 600)}

                  onTouchStart={() => setShowSizeLabel(true)}
                  onTouchEnd={() => setShowSizeLabel(false)}
                />

              </div>

            </div>

            {/* ===== AUDIO ===== */}
            <div className="settings-group">
              <h4>🔊 Audio</h4>

              {/* MUTE TOGGLE */}
              <div className="setting-item">
                <span>Mute Microphone</span>

                <div
                  className={`toggle ${isMuted ? "active" : ""}`}
                  onClick={() => {
                    setIsMuted(!isMuted);

                    if (!isMuted) {
                      stopListening(); // mute = stop mic
                    }
                  }}
                >
                  <div className="toggle-circle">
                    {isMuted ? "🔇" : "🔊"}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== THEME COLOR ===== */}
            {!darkMode && (
              <div className="settings-group">
                <h4>🎨 Theme Style</h4>

                <div className="theme-grid">

                  <div
                    className="theme-card blue"
                    onClick={() => {
                      setThemePreset("blue");
                      applyTheme("blue");
                    }}
                  >
                    🌊 Blue Ocean
                  </div>

                  <div
                    className="theme-card purple"
                    onClick={() => {
                      setThemePreset("purple");
                      applyTheme("purple");
                    }}
                  >
                    💜 Purple Glow
                  </div>

                </div>
              </div>
            )}

            
            {/* ===== FONT STYLE ===== */}
            <div className="settings-group">
              <h4>🔤 Font Style</h4>

              <div className="font-row">

                <button
                  className={`font-btn ${fontFamily === "system" ? "active" : ""}`}
                  onClick={() => setFontFamily("system")}
                >
                  Default
                </button>

                <button
                  className={`font-btn ${fontFamily === "poppins" ? "active" : ""}`}
                  onClick={() => setFontFamily("poppins")}
                >
                  Poppins
                </button>

                <button
                  className={`font-btn ${fontFamily === "mono" ? "active" : ""}`}
                  onClick={() => setFontFamily("mono")}
                >
                  Mono
                </button>

              </div>
            </div>
            
            {/*----- RESET BUTTON -----*/}
            <button onClick={resetSettings} className="reset-btn">
              Reset to Default
            </button>

          </div>

        </div>
      </div>

      {/* MAIN */}

      {page === "main" ? (
        // MAIN PAGE
        <div className="animated-bg">

          {/* TOPBAR */}
          {!isMobile && (
            <div className="topbar">

              {/* LEFT TITLE */}
              <h1 className="topbar-title">
                🎤 Smart Meeting Tool
              </h1>

              {/* RIGHT DARK MODE */}
              <div
                className="theme-toggle"
                onClick={() => setDarkMode(!darkMode)}
              >
                <div className="theme-toggle-circle">
                  {darkMode ? "🌙" : "☀️"}
                </div>
              </div>

            </div>
          )}

          {/* MOBILE TOPBAR */}
          {isMobile && (
            <div className="mobile-topbar">

              {/* TOGGLE BUTTON */}
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="mobile-menu-btn"
              >
                {showMenu ? <ArrowLeft size={18} /> : <Menu size={22} />}
              </button>

              {/* CENTER */}
              <div className="mobile-center">

                {/* LEFT */}
                <div className="mobile-left">
                  <strong className="mobile-title">
                    {showMenu ? "Menu" : "Smart Meeting Tool"}
                  </strong>
                </div>

                {/* RIGHT (DARK MODE) */}
                <div
                  className="theme-toggle"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  <div className="theme-toggle-circle">
                    {darkMode ? "🌙" : "☀️"}
                  </div>
                </div>

              </div>

              <div className="mobile-spacer" />

            </div>
          )}

          {/* BUTTONS */}
          <div className="button-bar">

            {/* LEFT: Start / Stop */}
            <div className="button-group">
              {!isListening ? (
                <button className="btn btn-start" onClick={startListening}>
                  <Play size={16} /> Start
                </button>
              ) : (
                <button className="btn btn-stop" onClick={stopListening}>
                  <Square size={16} /> Stop
                </button>
              )}
            </div>

            {/* STATUS */}
            {isListening && (
              <div className="button-group">
                <div className="status-text">
                  {volume > 10 ? "🎤 Hearing sound..." : "⚠️ Speak louder..."}
                </div>
              </div>
            )}

            {/* TIMER RIGHT */}
            {isListening && (
              <div className="button-group right">
                <div className="pulse-dot"></div>
                <div className="timer">
                  {formatTime(seconds)}
                </div>
              </div>
            )}

            {/* CLEAR BUTTON */}
            {!isListening && (
              <div className="button-group right">
                <button className="btn btn-clear" onClick={clearAll}>
                  <Trash2 size={16} /> Clear
                </button>
              </div>
            )}

          </div>

          {/* CHAT */}
          <div className="chat-card">
            <h2 className="chat-title">💬 Live Meeting Chat</h2>

            <div ref={chatRef} className="chat-list">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-msg ${msg.sender === "user" ? "user" : "speaker"}`}
                >
                  <strong>
                    {msg.sender === "user" ? "You" : "Speaker"}
                  </strong>

                  <div
                    className="chat-text"
                    style={{ fontSize: `${textSize}px` }}
                  >
                    {msg.text}
                  </div>

                  <small>{msg.time}</small>
                </div>
              ))}

              {liveText && (
                <div className="live-text">📝 {liveText}</div>
              )}
            </div>

            {/* INPUT */}
            <div className={`chat-input ${!isListening ? "disabled" : ""}`}>
              <textarea
                ref={inputRef}
                value={manualInput}
                onChange={handleInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addManualMessage();
                  }
                }}
                disabled={!isListening}
                placeholder={
                  isListening ? "Type message..." : "Start meeting to type..."
                }
                rows={1}
                className="chat-textarea"
              />

              <button
                onClick={addManualMessage}
                disabled={!isListening}
                className="chat-send"
              >
                <Send size={18} />
              </button>
            </div>

            {isMobile && showMenu && (
              <div
                className="mobile-overlay"
                onClick={() => setShowMenu(false)}
              />
            )}
          </div>

        </div>

      ) : page === "results" ? (
        //SUMMARY PAGE
        <div className="page-container">

          <button
            onClick={() => setPage("main")}
            className="btn btn-back"
          >
            ⬅ Back
          </button>

          <h2 className="page-title">📊 Summary</h2>

          <div className="card">
            <p className={loading ? "loading" : ""}>
              {loading ? "Generating..." : summary || "No summary yet"}
            </p>
          </div>

        </div>

      ) : page === "actions" ? (
        // ACTIONS PAGE
        <div className="page-container">

          <button
            onClick={() => setPage("main")}
            className="btn btn-warning"
          >
            ⬅ Back
          </button>

          <h2 className="page-title">✅ Action Items</h2>

          <div className="action-list">
            {actions.length === 0 ? (
              <p>No action items detected. This meeting looks informational.</p>
            ) : (
              actions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleAction(item.id)}
                  className={`action-item ${item.done ? "done" : ""}`}
                >
                  <div className="action-checkbox" />

                  <span className="action-text">
                    {item.text}
                  </span>
                </div>
              ))
            )}
          </div>

        </div>

      ) : page === "about" ? (
        //ABOUT PAGE
        <div className="page-container">

          <button
            onClick={() => setPage("main")}
            className="btn btn-back"
          >
            ⬅ Back
          </button>

          <h2 className="page-title">ℹ️ About</h2>

          <div className="about-grid">

            {/* WHAT */}
            <div
              className="about-card"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                e.currentTarget.style.setProperty("--x", `${x}px`);
                e.currentTarget.style.setProperty("--y", `${y}px`);
              }}
            >
              <div className="about-icon">🎤</div>
              <h3>Real-Time Capture</h3>
              <p>
                Converts live speech into instant text so you can follow every conversation.
              </p>
            </div>

            {/* AI */}
            <div
              className="about-card"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                e.currentTarget.style.setProperty("--x", `${x}px`);
                e.currentTarget.style.setProperty("--y", `${y}px`);
              }}
            >
              <div className="about-icon">🧠</div>
              <h3>Smart Summaries</h3>
              <p>
                Automatically generates summaries and action items from meetings.
              </p>
            </div>

            {/* ACCESSIBILITY */}
            <div
              className="about-card"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                e.currentTarget.style.setProperty("--x", `${x}px`);
                e.currentTarget.style.setProperty("--y", `${y}px`);
              }}
            >
              <div className="about-icon">♿</div>
              <h3>Accessibility First</h3>
              <p>
                Designed for deaf and hard-of-hearing users to make communication inclusive.
              </p>
            </div>

            {/* PRODUCTIVITY */}
            <div
              className="about-card"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                e.currentTarget.style.setProperty("--x", `${x}px`);
                e.currentTarget.style.setProperty("--y", `${y}px`);
              }}
            >
              <div className="about-icon">⚡</div>
              <h3>Boost Productivity</h3>
              <p>
                Stay organized and never miss key points during discussions.
              </p>
            </div>

          </div>

          {/* FOOTER */}
          <div className="about-footer">
            Built by <b>Botlhale Village Tech Hub</b>
          </div>

        </div>
      ) : (
        // HISTORY PAGE
        <div className="page-container">

          <h1 className="page-title">📚 Meeting History</h1>

          <button
            onClick={() => setPage("main")}
            className="btn btn-primary"
          >
            ⬅ Back
          </button>

          <div className="history-list">
            {history.length === 0 ? (
              <p>No meetings saved</p>
            ) : (
              history.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className="history-item"
                >
                  📅 {m.date} — ⏰ {m.time}

                  <div className="history-meta">
                    {m.mode}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DETAILS */}
          {selectedMeeting && (
            <div className="details-card">

              <h2 className="page-title">📄 Meeting Details</h2>

              <p><b>Date:</b> {selectedMeeting.date}</p>
              <p><b>Mode:</b> {selectedMeeting.mode}</p>

              <h3>Transcript</h3>
              <p>{selectedMeeting.transcript}</p>

              <h3>Summary</h3>
              <p>{selectedMeeting.summary}</p>

              <h3>Actions</h3>
              <p>{selectedMeeting.actions}</p>

              <button
                onClick={() => setSelectedMeeting(null)}
                className="btn btn-danger"
              >
                Close
              </button>

              <button
                onClick={() => downloadOldPDF(selectedMeeting)}
                className="btn btn-primary"
              >
                📄 Download PDF
              </button>

            </div>
          )}
        </div>
      )
      }

    </div>
  );
}

export default App;