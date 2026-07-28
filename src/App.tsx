import React, { useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { PreheatView } from "./components/PreheatView";
import { LiveWorkspace } from "./components/LiveWorkspace";
import { StudyModeView } from "./components/StudyModeView";
import { PrivacyBanner } from "./components/PrivacyBanner";
import { PRESET_COURSES } from "./data/presetCourses";
import {
  CoursePreset,
  GlossaryTerm,
  TranscriptChunk,
  ProgressiveSummary,
  RescueRecord,
  CornellNotes
} from "./types";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [currentView, setCurrentView] = useState<"live" | "preheat" | "study">("live");
  const [selectedCourse, setSelectedCourse] = useState<CoursePreset>(PRESET_COURSES[0]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(selectedCourse.initialGlossary);
  const [transcripts, setTranscripts] = useState<TranscriptChunk[]>([]);
  const [progressiveSummaries, setProgressiveSummaries] = useState<ProgressiveSummary[]>([]);
  const [rescueRecords, setRescueRecords] = useState<RescueRecord[]>([]);
  const [cornellNotes, setCornellNotes] = useState<CornellNotes | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      if (localStorage.getItem("lecturebridge-authorized") === "true") {
        setIsAuthorized(true);
        setAuthChecked(true);
        return;
      }

      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "" }),
        });
        const data = await res.json();
        if (data.success && !data.accessRequired) {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("Access check failed:", error);
      } finally {
        setAuthChecked(true);
      }
    };

    verifyAccess();
  }, []);

  const handleVerifyInviteCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("lecturebridge-authorized", "true");
        setIsAuthorized(true);
      } else {
        setAuthError("邀请码不正确，请检查后重试。");
      }
    } catch {
      setAuthError("无法连接服务器，请稍后重试。");
    }
  };

  // When course changes, update default glossary
  const handleSelectCourse = (course: CoursePreset) => {
    setSelectedCourse(course);
    setGlossary(course.initialGlossary);
    setTranscripts([]);
    setProgressiveSummaries([]);
    setRescueRecords([]);
    setCornellNotes(null);
  };

  const handleClearSession = () => {
    if (window.confirm("确定清空本节课的实时转录与救生圈历史记录吗？(此操作无法撤销)")) {
      setTranscripts([]);
      setProgressiveSummaries([]);
      setRescueRecords([]);
      setCornellNotes(null);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950/80 text-slate-100 font-sans flex items-center justify-center relative">
        <div className="mesh-gradient" />
        <div className="glass-card rounded-2xl px-6 py-5 border border-white/12 text-sm text-slate-300">
          正在检查访问权限...
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950/80 text-slate-100 font-sans flex items-center justify-center p-4 relative">
        <div className="mesh-gradient" />
        <form onSubmit={handleVerifyInviteCode} className="glass-card w-full max-w-sm rounded-2xl p-6 border border-white/12 shadow-2xl space-y-4">
          <div>
            <h1 className="text-xl font-bold text-white">LectureBridge AI</h1>
            <p className="text-xs text-slate-400 mt-1">请输入自建服务的邀请码继续使用。</p>
          </div>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="邀请码"
            className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {authError && <p className="text-xs text-rose-300">{authError}</p>}
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold border border-white/20"
          >
            进入
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950/80 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col antialiased relative">
      {/* Mesh Gradient Background */}
      <div className="mesh-gradient" />

      {/* Privacy Notice Banner */}
      <PrivacyBanner />

      {/* Primary Navigation Bar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        selectedCourse={selectedCourse}
        setSelectedCourse={handleSelectCourse}
        presetCourses={PRESET_COURSES}
        isRecording={isRecording}
        onToggleRecording={() => setCurrentView("live")}
        onClearSession={handleClearSession}
        termCount={glossary.length}
        rescueCount={rescueRecords.length}
      />

      {/* Main Content Workspace Views */}
      <main className="flex-1 pb-20">
        {currentView === "preheat" && (
          <PreheatView
            selectedCourse={selectedCourse}
            glossary={glossary}
            setGlossary={setGlossary}
            onStartLiveClass={() => setCurrentView("live")}
          />
        )}

        {currentView === "live" && (
          <LiveWorkspace
            selectedCourse={selectedCourse}
            glossary={glossary}
            transcripts={transcripts}
            setTranscripts={setTranscripts}
            progressiveSummaries={progressiveSummaries}
            setProgressiveSummaries={setProgressiveSummaries}
            rescueRecords={rescueRecords}
            setRescueRecords={setRescueRecords}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
          />
        )}

        {currentView === "study" && (
          <StudyModeView
            selectedCourse={selectedCourse}
            transcripts={transcripts}
            cornellNotes={cornellNotes}
            setCornellNotes={setCornellNotes}
          />
        )}
      </main>

      {/* App Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>LectureBridge AI · 中国留学生英语课堂双语降负与实时笔记智能体 V1.0</span>
          <span>Powered by Qwen3.7 & Qwen LiveTranslate server-side AI pipeline</span>
        </div>
      </footer>

    </div>
  );
}
