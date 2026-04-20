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
  const theme = {
    bg: darkMode ? "#0f172a" : "#f3f4f6",
    sidebar: darkMode ? "#111827" : "#ffffff",
    card: darkMode ? "#1f2937" : "#ffffff",
    text: darkMode ? "#f9fafb" : "#111827",

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
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
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

        setVolume(avg); // 👈 NEW STATE

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
      if (isManuallyStopped.current) return;

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

  return (
    // ---------- MAIN CONTAINER ----------
    <div className="main-container">

      {/* SIDEBAR */}
      <div className={`sidebar ${showMenu ? "open" : ""}`}>

        {/* TOP SECTION*/}

        {/*LOGO & TITLE */}
        <div className="header">
          <img
            src="/botlhale-logo.png"
            alt="Botlhale Village"
            className="header-logo"
          />

          <div>
            <div className="header-title">
              Botlhale Village
            </div>
          </div>
        </div>

        <div className="sidebar-top">
          {/* TOP */}
          <div className="panel-top">
            <h3 className="panel-title">Meeting Panel</h3>

            {/* MODE */}
            <div className="panel-mode">
              <label className="panel-label">
                Meeting Mode
              </label>

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
          </div>

          {/* BOTTOM ACTIONS */}
          <div className="sidebar-actions">

            <div className="sidebar-actions-label"></div>

            <button onClick={exportPDF} className="sidebar-btn btn-primary">
              <FileText size={18} /> Export PDF
            </button>

            <button
              onClick={() => {
                handleSummaryOnly();
                setPage("results");
                setShowMenu(false);
              }}
              className="sidebar-btn btn-success"
            >
              🧠 Generate Summary
            </button>

            <button
              onClick={() => {
                handleActionsOnly();
                setPage("actions");
                setShowMenu(false);
              }}
              className="sidebar-btn btn-warning"
            >
              ✅ Generate Actions
            </button>

            <button
              onClick={() => {
                setPage("history");
                setShowMenu(false);
              }}
              className="sidebar-btn btn-gray"
            >
              <History size={18} /> History
            </button>

            <button
              onClick={() => {
                setPage("about");
                setShowMenu(false);
              }}
              className="sidebar-btn btn-indigo btn-about"
            >
              ℹ️ About
            </button>

            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to log out?")) {
                  setPage("main");
                }
              }}
              className="sidebar-btn btn-danger"
            >
              Log out
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
                {showMenu ? <ArrowLeft size={22} /> : <Menu size={22} />}
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

                  <div className="chat-text">{msg.text}</div>

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
        <div style={{ flex: 1, padding: "20px" }}>

          <button
            onClick={() => setPage("main")}
            style={{ ...buttonStyle(), background: theme.primary }}
          >
            ⬅ Back
          </button>

          <h2 style={{ color: theme.text, marginTop: "20px" }}>
            ℹ️ About Smart Meeting Tool
          </h2>

          <div style={cardStyle}>
            <p>
              This Smart Meeting Tool captures live speech, converts it into text,
              and generates summaries and action items automatically.
            </p>

            <br />
            <div>
              <p>
                The Smart Meeting Tool is a powerful web application that captures
                live speech and converts it into real-time text. It uses AI to
                automatically generate summaries and extract action items,
                helping users stay organized and focused during meetings.
              </p>

              <br />

              <p>
                Designed with accessibility in mind, this tool supports deaf and
                hard-of-hearing users by making spoken conversations visible
                and easy to follow. It also allows users to export meeting
                notes into a structured PDF for future reference.
              </p>

              <br />

              <p>
                Built to improve productivity, clarity, and inclusivity in
                communication.
              </p>
            </div>

            <br />
            <br />
            <br />
            <p>
              Built by: <b>Botlhale Village Tech Hub</b>
            </p>
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