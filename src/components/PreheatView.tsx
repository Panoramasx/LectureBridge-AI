import React, { useState } from "react";
import { BookOpen, Sparkles, Plus, Check, FileText, ArrowRight, BookMarked, HelpCircle } from "lucide-react";
import { GlossaryTerm, CoursePreset } from "../types";

interface PreheatViewProps {
  selectedCourse: CoursePreset;
  glossary: GlossaryTerm[];
  setGlossary: React.Dispatch<React.SetStateAction<GlossaryTerm[]>>;
  onStartLiveClass: () => void;
}

export const PreheatView: React.FC<PreheatViewProps> = ({
  selectedCourse,
  glossary,
  setGlossary,
  onStartLiveClass,
}) => {
  const [syllabusInput, setSyllabusInput] = useState(selectedCourse.initialSyllabus);
  const [isLoading, setIsLoading] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newZh, setNewZh] = useState("");
  const [newDefEn, setNewDefEn] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Trigger Qwen API to analyze syllabus and extract technical jargon
  const handlePreload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/preload-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: selectedCourse.title,
          rawContent: syllabusInput,
        }),
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.terms)) {
        const mappedTerms: GlossaryTerm[] = data.terms.map((t: any, index: number) => ({
          id: `extracted-${Date.now()}-${index}`,
          term: t.term,
          chinese: t.chinese,
          phonetic: t.phonetic || "",
          definitionEn: t.definitionEn,
          definitionZh: t.definitionZh,
          category: t.category || "Jargon",
        }));

        // Merge with existing glossary avoiding duplicates
        const existingTermsSet = new Set(glossary.map((g) => g.term.toLowerCase()));
        const uniqueNew = mappedTerms.filter((t) => !existingTermsSet.has(t.term.toLowerCase()));

        setGlossary([...glossary, ...uniqueNew]);
      }
    } catch (err) {
      console.error("Preload error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddManualTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim() || !newZh.trim()) return;

    const termItem: GlossaryTerm = {
      id: `manual-${Date.now()}`,
      term: newTerm.trim(),
      chinese: newZh.trim(),
      definitionEn: newDefEn.trim() || newZh.trim(),
      definitionZh: newZh.trim(),
      category: "Custom Jargon",
    };

    setGlossary([termItem, ...glossary]);
    setNewTerm("");
    setNewZh("");
    setNewDefEn("");
    setShowAddForm(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Header card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8 text-slate-100 shadow-2xl relative overflow-hidden border border-white/12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
              <BookOpen className="w-3.5 h-3.5" />
              <span>课前准备 · 上下文预热 (Context Injection)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {selectedCourse.code}: {selectedCourse.title}
            </h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              开课前上传 PPT 或 Syllabus，AI 将提前识别并建立专有名词与高频术语库。老师上课讲到这些词汇时，系统将自动高亮并展示中文含义，避免卡壳！
            </p>
          </div>

          <button
            onClick={onStartLiveClass}
            className="self-start md:self-center px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg indigo-glow border border-white/20 flex items-center space-x-2 transition-all group"
          >
            <span>进入课堂实况听课</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload / Paste Syllabus Material */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-6 shadow-xl flex flex-col border border-white/12">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-slate-100 text-base">课程大纲 / 讲义大纲输入</h2>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            粘贴 PPT 大纲、Syllabus 或本节课主题文本，点击下方 AI 生成高频双语术语库。
          </p>

          <textarea
            value={syllabusInput}
            onChange={(e) => setSyllabusInput(e.target.value)}
            rows={10}
            placeholder="粘贴课程大纲、课前阅读文本或教授上传的 PPT 概要..."
            className="w-full bg-black/30 border border-white/15 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono resize-none leading-relaxed backdrop-blur-md"
          />

          <button
            onClick={handlePreload}
            disabled={isLoading || !syllabusInput.trim()}
            className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg indigo-glow border border-white/20"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>AI 正在抽取学术词库...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI 智能抽取专有名词与词汇</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Pre-heated Terms List */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-6 shadow-xl flex flex-col border border-white/12">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <BookMarked className="w-5 h-5 text-cyan-400" />
              <h2 className="font-semibold text-slate-100 text-base">
                已预热双语学术术语库 ({glossary.length} 词)
              </h2>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-200 rounded-lg border border-white/15 flex items-center space-x-1 transition-all backdrop-blur-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>自定义添加</span>
            </button>
          </div>

          {/* Add Manual Term Form */}
          {showAddForm && (
            <form onSubmit={handleAddManualTerm} className="mb-6 p-4 bg-black/40 border border-white/15 rounded-xl space-y-3 backdrop-blur-md">
              <h3 className="text-xs font-semibold text-indigo-400">手动新增课程专有名词</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="英文术语 (e.g. Liquidity Trap)"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="bg-black/30 border border-white/15 text-xs text-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="text"
                  placeholder="中文对照 (e.g. 流动性陷阱)"
                  value={newZh}
                  onChange={(e) => setNewZh(e.target.value)}
                  className="bg-black/30 border border-white/15 text-xs text-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>
              <input
                type="text"
                placeholder="简明解释/备注 (可选)"
                value={newDefEn}
                onChange={(e) => setNewDefEn(e.target.value)}
                className="w-full bg-black/30 border border-white/15 text-xs text-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow border border-white/20"
                >
                  保存词条
                </button>
              </div>
            </form>
          )}

          {/* Glossary Terms Cards */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {glossary.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">暂无预热词条，点击左侧按钮进行 AI 智能抽取。</p>
              </div>
            ) : (
              glossary.map((term) => (
                <div
                  key={term.id}
                  className="p-4 bg-black/30 border border-white/10 hover:border-white/20 rounded-xl transition-all group backdrop-blur-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-cyan-300 font-mono">
                          {term.term}
                        </span>
                        {term.phonetic && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {term.phonetic}
                          </span>
                        )}
                        {term.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                            {term.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-emerald-400 mt-1">
                        {term.chinese}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {term.definitionZh}
                  </p>
                  {term.definitionEn && (
                    <p className="text-[11px] text-slate-400 mt-1 italic font-mono">
                      "{term.definitionEn}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
