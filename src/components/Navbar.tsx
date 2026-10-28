import React from "react";
import { BookOpen, Layers, Mic, Sparkles, Trash2, Volume2 } from "lucide-react";
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

const navItems = [
  { id: "preheat" as const, label: "术语预热", Icon: BookOpen },
  { id: "live" as const, label: "课堂实时", Icon: Mic },
  { id: "study" as const, label: "课后复习", Icon: Layers },
];

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
  const selectCourse = (courseId: string) => {
    const found = presetCourses.find((course) => course.id === courseId);
    if (found) setSelectedCourse(found);
  };

  return (
    <>
      <header className="app-header sticky top-0 z-40">
        <div className="app-header-inner">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="brand-name">LectureBridge AI</span>
                <span className="brand-badge">Qwen</span>
              </div>
              <p className="brand-tagline">双语课堂认知降负工作台</p>
            </div>
          </div>

          <label className="course-picker">
            <span>当前课程</span>
            <select
              aria-label="选择当前课程"
              value={selectedCourse.id}
              onChange={(event) => selectCourse(event.target.value)}
            >
              {presetCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
          </label>

          <nav className="desktop-nav" aria-label="主导航">
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={currentView === id ? "page" : undefined}
                onClick={() => setCurrentView(id)}
                className={currentView === id ? "nav-item is-active" : "nav-item"}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {id === "preheat" && termCount > 0 && <span className="nav-count">{termCount}</span>}
                {id === "live" && isRecording && <span className="recording-dot" aria-label="正在录音" />}
                {id === "study" && rescueCount > 0 && <span className="nav-count">{rescueCount}</span>}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              onClick={onToggleRecording}
              aria-label={isRecording ? "本机麦克风监听中" : "进入课堂实时工作区"}
              className={isRecording ? "record-status is-recording" : "record-status"}
            >
              {isRecording ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isRecording ? "监听中" : "实时课堂"}</span>
            </button>
            <button
              type="button"
              onClick={onClearSession}
              aria-label="清空当前课堂记录"
              title="清空当前课堂记录"
              className="icon-action danger-action"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={currentView === id ? "page" : undefined}
            onClick={() => setCurrentView(id)}
            className={currentView === id ? "mobile-nav-item is-active" : "mobile-nav-item"}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
            {id === "live" && isRecording && <span className="recording-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>
    </>
  );
};
