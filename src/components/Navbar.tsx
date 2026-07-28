import React from "react";
import { Sparkles, Mic, BookOpen, Layers, Trash2, MicOff, Volume2 } from "lucide-react";
import { CoursePreset } from "../types";

interface NavbarProps {
  currentView: "live" | "preheat" | "study";
  setCurrentView: (view: "live" | "preheat" | "study") => void;
  selectedCourse: CoursePreset;
  setSelectedCourse: (course: CoursePreset) => void;
  presetCourses: CoursePreset[];
  isRecording: boolean;
  onToggleRecording: () => void;
  onClearSession: () => void;
  termCount: number;
  rescueCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  selectedCourse,
  setSelectedCourse,
  presetCourses,
  isRecording,
  onToggleRecording,
  onClearSession,
  termCount,
  rescueCount,
}) => {
  return (
    <header className="glass sticky top-0 z-40 text-slate-100 shadow-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  LectureBridge AI
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  V1.0 双语助理
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                留学生英语课堂实时增强与认知降负系统
              </p>
            </div>
          </div>

          {/* Course Selector */}
          <div className="hidden lg:flex items-center space-x-2 bg-black/25 p-1.5 rounded-xl border border-white/10 backdrop-blur-md">
            <span className="text-xs text-slate-400 px-2 font-medium">当前课程:</span>
            <select
              value={selectedCourse.id}
              onChange={(e) => {
                const found = presetCourses.find((c) => c.id === e.target.value);
                if (found) setSelectedCourse(found);
              }}
              className="bg-slate-900/90 text-xs text-slate-200 border border-white/10 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-medium cursor-pointer"
            >
              {presetCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title.slice(0, 28)}...
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Mode Tabs */}
          <nav className="flex items-center space-x-1 bg-black/30 p-1 rounded-xl border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setCurrentView("preheat")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === "preheat"
                  ? "bg-indigo-600/90 text-white shadow-md border border-white/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>术语预热</span>
              {termCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-indigo-900/80 text-indigo-200 rounded-full border border-indigo-500/30">
                  {termCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView("live")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === "live"
                  ? "bg-indigo-600/90 text-white shadow-md border border-white/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>课堂实时</span>
              {isRecording && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 active-glow animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setCurrentView("study")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === "study"
                  ? "bg-indigo-600/90 text-white shadow-md border border-white/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>课后复习</span>
            </button>
          </nav>

          {/* Action Tools */}
          <div className="flex items-center space-x-2">
            
            {/* Direct Local Device Microphone Button */}
            <button
              onClick={onToggleRecording}
              title={isRecording ? "本机麦克风监听中" : "进入课堂实时工作区"}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center space-x-1.5 backdrop-blur-md ${
                isRecording
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                  : "bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-400/30"
              }`}
            >
              {isRecording ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                  <span className="font-semibold">本机麦克风: 监听中</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-indigo-300" />
                  <span>进入实时课堂</span>
                </>
              )}
            </button>

            {/* Clear Session */}
            <button
              onClick={onClearSession}
              title="清空记录 (符合课堂隐私规范)"
              className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-950/40 rounded-xl border border-white/10 hover:border-rose-500/30 transition-all backdrop-blur-md"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
