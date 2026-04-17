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

  useEffect(() => {
    if (isMobile && showMenu) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [showMenu, isMobile]);

  // ---------- THEME ----------
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

  // ---------- SPEECH ----------
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

  // ---------- DETAILED LOCAL SUMMARIZER ----------
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

  // ---------- SUMMARY ----------
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

  // Summary 
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

  const toggleAction = (id) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, done: !a.done } : a
      )
    );
  };

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

  // ---------- PDF ----------
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

  const buttonStyle = (color) => ({
    padding: "10px 18px",
    borderRadius: "6px",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    margin: "5px",
  });

  const cardStyle = {
    background: theme.card,
    padding: isMobile ? "14px" : "20px", // ✅ smaller on mobile
    borderRadius: "10px",
    height: "70vh",
    transition: "background 0.4s ease, color 0.4s ease, border 0.4s ease",
  };

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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const pulseStyle = {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "red",
    animation: "pulse 1s infinite",
  };

  const pulseKeyframes = `
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.6); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
`;
  const handleInput = (e) => {
    setManualInput(e.target.value);

    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = pulseKeyframes;
    document.head.appendChild(style);

    return () => document.head.removeChild(style);
  }, []);

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

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      setDarkMode(JSON.parse(savedMode));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
       // height: "100vh",
        background: theme.bg,
        color: theme.text,
        transition: "background 0.4s ease, color 0.4s ease",
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          position: isMobile ? "fixed" : "relative",
          top: isMobile ? "88px" : "0",
          left: 0,
          height: isMobile ? "calc(100vh - 88px)" : "auto",
          width: isMobile ? "260px" : "220px",
          background: theme.sidebar,
          zIndex: 30,

          transform: isMobile
            ? showMenu
              ? "translateX(0)"
              : "translateX(-100%)"
            : "none",

          transition: "transform 0.3s ease, background 0.4s ease",
          boxShadow: isMobile && showMenu ? "2px 0 10px rgba(0,0,0,0.3)" : "none",
        }}
      >
        {/* TOP SECTION*/}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "20px" }}>
          <img
            src="/botlhale-logo.png"
            alt="Botlhale Village"
            style={{ width: "40px", height: "40px", objectFit: "contain", paddingLeft: "20px" }}
          />

          <div>
            <div style={{ fontWeight: "bold", color: theme.primary }}>
              Botlhale Village
            </div>
          </div>
        </div>

        <div
          style={{
            width: "85%",
            paddingLeft: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* TOP */}
          <div>
            <h3 style={{ marginBottom: "15px" }}> Meeting Panel</h3>

            {/* MODE */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ fontSize: "12px", opacity: 0.7 }}>
                Meeting Mode
              </label>

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  marginTop: "5px",
                }}
              >
                <option>Daily Standup</option>
                <option>Technical Discussion</option>
                <option>HR / Admin</option>
              </select>
            </div>

            {/* DARK MODE */}

          </div>

          {/* BOTTOM ACTIONS */}
          <div>
            <div
              style={{
                marginBottom: "10px",
                fontSize: "12px",
                opacity: 0.6,
              }}
            >
            </div>

            <button
              onClick={exportPDF}
              style={{
                width: "100%",
                padding: isMobile ? "14px" : "10px",
                borderRadius: "8px",
                border: "none",
                background: theme.primary,
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <FileText size={18} /> Export PDF
            </button>
          </div>
          <button
            onClick={() => {
              handleSummaryOnly();
              setPage("results");
              setShowMenu(false);
            }}
            style={{
              width: "100%",
              padding: isMobile ? "14px" : "10px",
              borderRadius: "8px",
              border: "none",
              background: theme.success,
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            🧠 Generate Summary
          </button>

          <button
            onClick={() => {
              handleActionsOnly();
              setPage("actions");
              setShowMenu(false);
            }}
            style={{
              width: "100%",
              padding: isMobile ? "14px" : "10px",
              borderRadius: "8px",
              border: "none",
              background: theme.warning,
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            ✅ Generate Actions
          </button>

          <button
            onClick={() => {
              setPage("history");
              setShowMenu(false);
            }}
            style={{
              width: "100%",
              padding: isMobile ? "14px" : "10px",
              borderRadius: "8px",
              border: "none",
              background: "gray",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <History size={18} /> History
          </button>

          <button
            onClick={() => {
              setPage("about");
              setShowMenu(false);
            }}
            style={{
              width: "100%",
              padding: isMobile ? "14px" : "10px",
              borderRadius: "8px",
              border: "none",
              background: "#6366f1",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              marginBottom: "10px",
              marginTop: "85px", // push to bottom
            }}
          >
            ℹ️ About
          </button>

          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to log out?")) {
                // Clear all data and reset states
                setPage("main");
              }
            }}
            style={{
              width: "100%",
              padding: isMobile ? "14px" : "10px",
              borderRadius: "8px",
              border: "none",
              background: theme.danger,
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* MAIN */}

      {page === "main" ? (
        // MAIN PAGE
        <div className="animated-bg" style={{
          flex: 1,
          paddingTop: isMobile ? "10px" : "0px",
          paddingBottom: isMobile ? "10px" : "0px",
          paddingLeft: isMobile ? "10px" : "20px",
          paddingRight: isMobile ? "10px" : "20px",
          overflowY: "auto"
        }}>
          {!isMobile && (
            <h1 className="text-white p-10">
              🎤 Smart Meeting Tool
            </h1>
          )}

          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: theme.sidebar,
                borderBottom: `1px solid ${theme.border}`,
                position: "sticky",
                top: 0,
                zIndex: 20,
              }}
            >
              {/* TOGGLE BUTTON */}
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: theme.text,
                  marginRight: "50px",
                }}
              >
                {showMenu ? <ArrowLeft size={22} /> : <Menu size={22} />}
              </button>

              {/* TITLE CHANGES */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between", // 👈 key fix
                  width: "100%",
                }}
              >
                {/* LEFT SIDE */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <strong style={{ fontSize: "16px" }}>
                    {showMenu ? "Menu" : "Smart Meeting Tool"}
                  </strong>
                </div>

                {/* RIGHT SIDE (DARK MODE SWITCH) */}
                <div
                  onClick={() => setDarkMode(!darkMode)}
                  style={{
                    width: "52px",
                    height: "26px",
                    borderRadius: "999px",
                    background: darkMode ? "#1f2937" : "#fbbf24",
                    position: "relative",
                    cursor: "pointer",
                    transition: "0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    padding: "2px",
                    boxShadow: "inset 0 0 5px rgba(0,0,0,0.2)",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: darkMode ? "#374151" : "#fff7ed",
                      position: "absolute",
                      top: "2px",
                      left: darkMode ? "28px" : "2px",
                      transition: "0.3s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    }}
                  >
                    {darkMode ? "🌙" : "☀️"}
                  </div>
                </div>
              </div>

              <div style={{ width: "22px" }} />
            </div>
          )}

          {/* BUTTONS */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px", marginTop: "10px" }}>

            {/* Left group: Start / Stop */}
            <div style={{ display: "flex", gap: "10px" }}>
              {!isListening ? (
                <button style={{
                  ...buttonStyle(),
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)"
                }}
                  onClick={startListening}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  <Play size={16} /> Start
                </button>
              ) : (
                <button style={{
                  ...buttonStyle(),
                  background: "linear-gradient(135deg, #ef4444, #f87171)"
                }} onClick={stopListening}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                  <Square size={16} /> Stop
                </button>
              )}
            </div>

            {isListening && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

                {/* TEXT */}
                <div style={{ textAlign: "center", fontSize: "14px", opacity: 0.8, color: theme.text }}>
                  {isListening && volume > 10 ? "🎤 Hearing sound..." : "⚠️ Speak louder..."}
                </div>

              </div>
            )}
            {isListening && (
              <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", gap: "10px" }}>
                <div style={pulseStyle}></div>

                <div style={{ fontWeight: "bold" }}>
                  {formatTime(seconds)}
                </div>
              </div>
            )}

            {/* Right group: Clear */}
            {!isListening && (
              <div style={{ display: "flex", marginLeft: "auto" }}>
                <button
                  style={{
                    ...buttonStyle(),
                    background: "linear-gradient(135deg, #f97316, #fb923c)"
                  }}
                  onClick={clearAll}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  <Trash2 size={16} /> Clear
                </button>
              </div>
            )}

          </div>

          {/* CHAT */}
          <div style={cardStyle}>
            <h2 style={{ color: theme.text }}>💬 Live Meeting Chat</h2>

            <div
              ref={chatRef}
              style={{
                fontFamily: "Arial",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "10px",
                height: "58vh",
              }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    background:
                      msg.sender === "user" ? theme.success : theme.primary,
                    color: "white",
                    padding: "10px",
                    borderRadius: "10px",
                    maxWidth: "70%",
                    alignSelf:
                      msg.sender === "user" ? "flex-end" : "flex-start",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  <strong style={{ fontSize: "11px" }}>
                    {msg.sender === "user" ? "You" : "Speaker"}
                  </strong>

                  <div style={{ whiteSpace: "pre-line", wordBreak: "break-word", textAlign: "left" }}>{msg.text}</div>

                  <small style={{ fontSize: "10px", opacity: 0.8 }}>
                    {msg.time}
                  </small>
                </div>
              ))}

              {liveText && (
                <div style={{ opacity: 0.6, fontStyle: "italic" }}>
                  📝 {liveText}
                </div>
              )}
            </div>

            {/* ✅ INPUT AREA (INSIDE CHAT) */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flex: 1,
                background: !isListening
                  ? "#ccc"
                  : darkMode
                    ? "#3a3a3a"
                    : "#f1f1f1",
                borderRadius: "25px",
                padding: "8px 12px",
                opacity: !isListening ? 0.6 : 1,
                position: "relative",
              }}
            >
              {/* TEXTAREA */}
              <textarea
                ref={inputRef}
                value={manualInput}
                onChange={handleInput}
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
                style={{
                  fontFamily: "Arial",
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: theme.text,
                  fontSize: isMobile ? "14px" : "13px",
                  resize: "none",
                  maxHeight: "120px",
                  overflowY: "auto",
                  paddingRight: "40px", // 👈 space for send button
                }}

              />

              {/* SEND BUTTON INSIDE */}
              <button
                onClick={addManualMessage}
                disabled={!isListening}
                style={{
                  position: "absolute",
                  right: "10px",
                  bottom: "8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: theme.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={18} />
              </button>
            </div>
            {isMobile && showMenu && (
              <div
                onClick={() => setShowMenu(false)}
                style={{
                  position: "fixed",
                  top: "60px",
                  left: 0,
                  width: "100%",
                  height: "calc(100vh - 60px)",
                  background: "rgba(0,0,0,0.4)", // dark overlay
                  backdropFilter: "blur(4px)",   // 🔥 blur effect
                  zIndex: 10,
                }}
              />
            )}
          </div>

        </div>

      ) : page === "results" ? (
        //SUMMARY PAGE
        <div style={{ flex: 1, padding: "20px" }}>

          <button
            onClick={() => setPage("main")}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            style={{ ...buttonStyle(), background: "linear-gradient(135deg, #10b981, #34d399)" }}
          >
            ⬅ Back
          </button>

          <h2 style={{ color: theme.text }}>📊 Summary</h2>

          <div style={cardStyle}>
            <p>
              {loading ? "Generating..." : summary || "No summary yet"}
            </p>
          </div>

        </div>

      ) : page === "actions" ? (
        //ACTIONS PAGE
        <div style={{ flex: 1, padding: "20px" }}>

          <button
            onClick={() => setPage("main")}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            style={{ ...buttonStyle(), background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}
          >
            ⬅ Back
          </button>

          <h2 style={{ color: theme.text }}>✅ Action Items</h2>

          <div style={{ marginTop: "20px" }}>
            {actions.length === 0 ? (
              <p>No action items detected. This meeting looks informational.</p>
            ) : (
              actions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleAction(item.id)}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "4px",
                      border: "2px solid",
                      borderColor: item.done ? theme.success : theme.border,
                      background: item.done ? theme.success : "transparent",
                    }}
                  />

                  <span
                    style={{
                      textDecoration: item.done ? "line-through" : "none",
                    }}
                  >
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
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          <h1 style={{ color: theme.text }}>📚 Meeting History</h1>

          <button
            onClick={() => setPage("main")}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            style={buttonStyle(theme.primary)}
          >
            ⬅ Back
          </button>

          <div style={{ marginTop: "20px" }}>
            {history.length === 0 ? (
              <p>No meetings saved</p>
            ) : (
              history.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                  style={{
                    padding: "15px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  📅 {m.date} — ⏰ {m.time}
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    {m.mode}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DETAILS */}
          {selectedMeeting && (
            <div style={{ ...cardStyle, marginTop: "20px" }}>
              <h2 style={{ color: theme.text }}>📄 Meeting Details</h2>

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
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                style={buttonStyle(theme.danger)}
              >
                Close
              </button>

              <button
                onClick={() => downloadOldPDF(selectedMeeting)}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                style={buttonStyle(theme.primary)}
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