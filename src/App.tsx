import React, { useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { PreheatView } from "./components/PreheatView";
import { LiveWorkspace } from "./components/LiveWorkspace";
import { StudyModeView } from "./components/StudyModeView";
import { PrivacyBanner } from "./components/PrivacyBanner";
import { SessionToolbar } from "./components/SessionToolbar";
import { PRESET_COURSES } from "./data/presetCourses";
import {
  deleteSession,
  getActiveSessionId,
  getSession,
  listCourseSessions,
  saveSession,
  setActiveSessionId,
} from "./lib/localDb";
import { downloadTextFile, parseImportedSession, sessionToMarkdown } from "./lib/sessionTransfer";
import {
  CoursePreset,
  GlossaryTerm,
  TranscriptChunk,
  ProgressiveSummary,
  RescueRecord,
  CornellNotes,
  LectureSession,
} from "./types";

const makeSession = (course: CoursePreset): LectureSession => {
  const now = new Date().toISOString();
  return {
    id: `session-${course.id}-${Date.now()}`,
    courseId: course.id,
    createdAt: now,
    updatedAt: now,
    glossary: course.initialGlossary,
    transcripts: [],
    progressiveSummaries: [],
    rescueRecords: [],
    cornellNotes: null,
  };
};

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
  const [sessionId, setSessionId] = useState("");
  const [sessionCreatedAt, setSessionCreatedAt] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const applySession = (session: LectureSession) => {
    setSessionId(session.id);
    setSessionCreatedAt(session.createdAt);
    setGlossary(session.glossary);
    setTranscripts(session.transcripts);
    setProgressiveSummaries(session.progressiveSummaries);
    setRescueRecords(session.rescueRecords);
    setCornellNotes(session.cornellNotes);
    setActiveSessionId(session.courseId, session.id);
  };

  const restoreCourseSession = async (course: CoursePreset) => {
    setSessionReady(false);
    const activeId = getActiveSessionId(course.id);
    const active = activeId ? await getSession(activeId) : undefined;
    const latest = active || (await listCourseSessions(course.id))[0];
    const session = latest || makeSession(course);
    if (!latest) await saveSession(session);
    applySession(session);
    setSessionReady(true);
  };

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

  useEffect(() => {
    void restoreCourseSession(selectedCourse);
  }, []);

  useEffect(() => {
    if (!sessionReady || !sessionId) return;
    const timer = window.setTimeout(() => {
      void saveSession({
        id: sessionId,
        courseId: selectedCourse.id,
        createdAt: sessionCreatedAt,
        updatedAt: new Date().toISOString(),
        glossary,
        transcripts,
        progressiveSummaries,
        rescueRecords,
        cornellNotes,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    sessionReady,
    sessionId,
    sessionCreatedAt,
    selectedCourse.id,
    glossary,
    transcripts,
    progressiveSummaries,
    rescueRecords,
    cornellNotes,
  ]);

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
    void restoreCourseSession(course);
  };

  const handleNewSession = async () => {
    if (isRecording) return;
    const session = makeSession(selectedCourse);
    await saveSession(session);
    applySession(session);
  };

  const handleClearSession = async () => {
    if (window.confirm("确定清空本节课的实时转录与救生圈历史记录吗？(此操作无法撤销)")) {
      await deleteSession(sessionId);
      const session = makeSession(selectedCourse);
      await saveSession(session);
      applySession(session);
    }
  };

  const currentSession = (): LectureSession => ({
    id: sessionId,
    courseId: selectedCourse.id,
    createdAt: sessionCreatedAt,
    updatedAt: new Date().toISOString(),
    glossary,
    transcripts,
    progressiveSummaries,
    rescueRecords,
    cornellNotes,
  });

  const exportBaseName = `${selectedCourse.code}-${sessionCreatedAt.slice(0, 10) || "lecture"}`;

  const handleImport = async (file: File) => {
    try {
      const imported = parseImportedSession(JSON.parse(await file.text()));
      const course = PRESET_COURSES.find((item) => item.id === imported.courseId);
      if (!course) throw new Error("备份中的课程不在当前课程列表中。");
      const restored = { ...imported, id: `session-${course.id}-${Date.now()}` };
      await saveSession(restored);
      setSelectedCourse(course);
      applySession(restored);
      setSessionReady(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "导入失败。");
    }
  };

  if (!authChecked) {
    return (
      <div className="app-shell min-h-dvh flex items-center justify-center relative">
        <div className="mesh-gradient" />
        <div className="glass-card rounded-2xl px-6 py-5 border border-white/12 text-sm text-slate-300">
          正在检查访问权限...
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="app-shell min-h-dvh flex items-center justify-center p-4 relative">
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
    <div className="app-shell min-h-dvh selection:bg-indigo-500 selection:text-white flex flex-col antialiased relative">
      <a href="#main-content" className="skip-link">跳到主要内容</a>
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

      <SessionToolbar
        sessionLabel={sessionCreatedAt ? `当前课堂：${new Date(sessionCreatedAt).toLocaleString()} · 自动保存在本机` : "正在恢复课堂..."}
        onNewSession={handleNewSession}
        onExportMarkdown={() => downloadTextFile(`${exportBaseName}.md`, sessionToMarkdown(currentSession(), selectedCourse), "text/markdown;charset=utf-8")}
        onExportJson={() => downloadTextFile(`${exportBaseName}.json`, JSON.stringify(currentSession(), null, 2), "application/json;charset=utf-8")}
        onImportJson={handleImport}
      />

      {/* Main Content Workspace Views */}
      <main id="main-content" className="flex-1 pb-24 lg:pb-10" tabIndex={-1}>
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
      <footer className="app-footer py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>LectureBridge AI · 中国留学生英语课堂双语降负与实时笔记智能体 V1.0</span>
          <span>Powered by Qwen3.7 & Qwen LiveTranslate server-side AI pipeline</span>
        </div>
      </footer>

    </div>
  );
}
