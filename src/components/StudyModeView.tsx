import React, { useState } from "react";
import {
  BookOpen, Sparkles, HelpCircle, CheckCircle, RotateCw, Download, FileText,
  Layers, Check, ChevronRight, Copy
} from "lucide-react";
import { CoursePreset, TranscriptChunk, CornellNotes } from "../types";
import { cachedPost } from "../lib/cachedApi";

interface StudyModeViewProps {
  selectedCourse: CoursePreset;
  transcripts: TranscriptChunk[];
  cornellNotes: CornellNotes | null;
  setCornellNotes: React.Dispatch<React.SetStateAction<CornellNotes | null>>;
}

export const StudyModeView: React.FC<StudyModeViewProps> = ({
  selectedCourse,
  transcripts,
  cornellNotes,
  setCornellNotes,
}) => {
  const [activeTab, setActiveTab] = useState<"cornell" | "flashcards" | "quiz">("cornell");
  const [isLoading, setIsLoading] = useState(false);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userQuizAnswers, setUserQuizAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate Cornell Notes & Study Guide via Qwen
  const handleGenerateNotes = async () => {
    setIsLoading(true);
    try {
      const fullText = transcripts.length > 0
        ? transcripts.map((t) => t.textEn).join("\n")
        : selectedCourse.simulatedAudioScript.map((s) => s.textEn).join("\n");

      const data = await cachedPost<any>("/api/generate-study-notes", {
          fullTranscripts: fullText,
          courseTitle: selectedCourse.title,
      });
      if (data.success && data.notesData) {
        setCornellNotes(data.notesData);
      }
    } catch (err) {
      console.error("Error generating study notes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!cornellNotes) return;
    const mdText = `# ${selectedCourse.code}: ${selectedCourse.title} - 康奈尔笔记

## 课程中文概要
${cornellNotes.chineseSummary}

## 核心提问 (Cue Column)
${cornellNotes.cueQuestions.map((q) => `- Q: ${q.questionEn} (${q.questionZh})\n  A: ${q.answerZh}`).join("\n\n")}

## 详细课堂笔记
${cornellNotes.detailedNotesMarkdown}
`;

    navigator.clipboard.writeText(mdText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8 text-slate-100 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/12">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
            <Layers className="w-3.5 h-3.5" />
            <span> Study Mode · 课后复习与康奈尔笔记</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {selectedCourse.code} 课后复习工作台
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            将整节课的零散转录一键智能重构为“康奈尔笔记(Cornell Notes)”、双语记忆卡片与自测题目。
          </p>
        </div>

        <button
          onClick={handleGenerateNotes}
          disabled={isLoading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg indigo-glow border border-white/20 flex items-center space-x-2 transition-all self-start md:self-center disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>AI 正在整合全课讲义...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{cornellNotes ? "重新生成康奈尔复习指南" : "生成康奈尔笔记与复习卡"}</span>
            </>
          )}
        </button>
      </div>

      {!cornellNotes && !isLoading && (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 space-y-4 shadow-xl border border-white/10">
          <BookOpen className="w-12 h-12 mx-auto text-indigo-400" />
          <h3 className="text-base font-bold text-slate-200">点击上方按钮，生成本节课的完整康奈尔笔记</h3>
          <p className="text-xs max-w-md mx-auto text-slate-400">
            AI 将把课堂上的英文原音转录提取为中文总论、左栏核心提问、右栏 Markdown 详细笔记以及交互式背词卡片。
          </p>
        </div>
      )}

      {isLoading && (
        <div className="glass-card rounded-2xl p-16 text-center space-y-4 shadow-xl border border-white/10">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-200">正在提炼讲义与逻辑链条...</h3>
          <p className="text-xs text-slate-400">生成中英双语 Cornell Notes 框架、Flashcards 与测试题</p>
        </div>
      )}

      {cornellNotes && !isLoading && (
        <div className="space-y-6">
          
          {/* Sub-navigation tabs */}
          <div className="flex items-center justify-between bg-black/40 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab("cornell")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "cornell"
                    ? "bg-indigo-600/90 text-white shadow border border-white/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                康奈尔笔记 (Cornell Notes)
              </button>

              <button
                onClick={() => setActiveTab("flashcards")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "flashcards"
                    ? "bg-indigo-600/90 text-white shadow border border-white/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                双语背词卡片 ({cornellNotes.flashcards.length})
              </button>

              <button
                onClick={() => setActiveTab("quiz")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "quiz"
                    ? "bg-indigo-600/90 text-white shadow border border-white/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                课后自测题 ({cornellNotes.quiz.length})
              </button>
            </div>

            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl border border-white/15 text-xs font-medium flex items-center space-x-1.5 transition-colors backdrop-blur-md"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "已复制 Markdown" : "复制为 Markdown"}</span>
            </button>
          </div>

          {/* TAB 1: CORNELL NOTES */}
          {activeTab === "cornell" && (
            <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-white/12">
              
              {/* Top Executive Chinese Summary */}
              <div className="p-5 bg-gradient-to-r from-indigo-950/80 to-black/60 border border-indigo-500/30 rounded-xl space-y-2 backdrop-blur-md">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                  全课中文概要总结 (Executive Summary)
                </span>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {cornellNotes.chineseSummary}
                </p>
              </div>

              {/* Classic 2-Column Cornell Structure */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                
                {/* Cue Column (4 cols) */}
                <div className="lg:col-span-4 bg-black/40 border border-white/10 rounded-xl p-5 space-y-4 backdrop-blur-md">
                  <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-wider border-b border-white/10 pb-2">
                    Cue Column · 核心疑问与关键名词
                  </h3>

                  <div className="space-y-4">
                    {cornellNotes.cueQuestions.map((cq, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-1">
                        <span className="font-bold text-xs text-slate-100 block">{cq.questionEn}</span>
                        <span className="text-[11px] text-slate-400 block font-semibold">{cq.questionZh}</span>
                        <p className="text-xs text-emerald-400 font-medium pt-1 border-t border-white/10 mt-1">
                          A: {cq.answerZh}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes Column (8 cols) */}
                <div className="lg:col-span-8 bg-black/40 border border-white/10 rounded-xl p-5 space-y-4 backdrop-blur-md">
                  <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider border-b border-white/10 pb-2">
                    Detailed Notes · 课堂知识点逻辑展开
                  </h3>

                  <div className="prose prose-invert prose-xs max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                    {cornellNotes.detailedNotesMarkdown}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: FLASHCARDS */}
          {activeTab === "flashcards" && (
            <div className="glass-card rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6 border border-white/12">
              <span className="text-xs text-slate-400 font-medium">
                卡片 {currentFlashcardIndex + 1} / {cornellNotes.flashcards.length} (点击卡片翻面)
              </span>

              {/* Flip Card Container */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-lg h-64 bg-black/40 border border-indigo-500/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 transition-all shadow-2xl relative backdrop-blur-md indigo-glow"
              >
                {!isFlipped ? (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                      正面 FRONT
                    </span>
                    <h3 className="text-xl font-bold text-white font-mono">
                      {cornellNotes.flashcards[currentFlashcardIndex]?.front}
                    </h3>
                    <span className="text-[11px] text-slate-400 block pt-4">
                      👉 点击翻面查看中文释义
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                      背面 BACK
                    </span>
                    <p className="text-base font-semibold text-emerald-300 leading-relaxed">
                      {cornellNotes.flashcards[currentFlashcardIndex]?.back}
                    </p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentFlashcardIndex((prev) => (prev > 0 ? prev - 1 : cornellNotes.flashcards.length - 1));
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold rounded-xl border border-white/15"
                >
                  上一张
                </button>

                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-white/20"
                >
                  翻转卡片
                </button>

                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentFlashcardIndex((prev) => (prev < cornellNotes.flashcards.length - 1 ? prev + 1 : 0));
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold rounded-xl border border-white/15"
                >
                  下一张
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: QUIZ */}
          {activeTab === "quiz" && (
            <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 border border-white/12">
              <h3 className="font-bold text-base text-slate-100 border-b border-white/10 pb-3">
                课后巩固自测题
              </h3>

              <div className="space-y-6">
                {cornellNotes.quiz.map((q, qIdx) => (
                  <div key={qIdx} className="p-5 bg-black/40 border border-white/10 rounded-xl space-y-3 backdrop-blur-md">
                    <span className="font-bold text-sm text-slate-100 block">
                      {qIdx + 1}. {q.question}
                    </span>

                    <div className="space-y-2 pt-1">
                      {q.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => setUserQuizAnswers({ ...userQuizAnswers, [qIdx]: optIdx })}
                          className={`w-full text-left p-3 rounded-lg text-xs font-medium transition-all border ${
                            userQuizAnswers[qIdx] === optIdx
                              ? "bg-indigo-950/80 text-indigo-200 border-indigo-400"
                              : "bg-black/30 text-slate-300 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {showQuizResults && (
                      <div className={`p-3 rounded-lg text-xs font-medium mt-3 border ${
                        userQuizAnswers[qIdx] === q.correctIndex
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-950/80 text-rose-300 border-rose-500/40"
                      }`}>
                        <span className="font-bold block mb-0.5">
                          {userQuizAnswers[qIdx] === q.correctIndex ? "✅ 回答正确" : `❌ 解析 (正确答案: ${q.options[q.correctIndex]})`}:
                        </span>
                        <p>{q.explanationZh}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setShowQuizResults(!showQuizResults)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow border border-white/20"
                >
                  {showQuizResults ? "隐藏答案解析" : "查看测试答案解析"}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
