import React, { useState, useEffect } from "react";
import { LifeBuoy, X, Sparkles, MessageCircle, AlertCircle, HelpCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { RescueRecord } from "../types";
import { cachedPost } from "../lib/cachedApi";

interface RescueModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippetText: string;
  timestamp: string;
  courseTitle: string;
  onSaveRescueRecord: (record: RescueRecord) => void;
}

export const RescueModal: React.FC<RescueModalProps> = ({
  isOpen,
  onClose,
  snippetText,
  timestamp,
  courseTitle,
  onSaveRescueRecord,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [rescueData, setRescueData] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && snippetText) {
      handleRescueAnalysis();
    } else {
      setRescueData(null);
    }
  }, [isOpen, snippetText]);

  const handleRescueAnalysis = async () => {
    setIsLoading(true);
    try {
      const data = await cachedPost<any>("/api/rescue-analysis", {
          snippetText,
          timestamp,
          courseTitle,
      });
      if (data.success && data.rescueData) {
        setRescueData(data.rescueData);
        
        const record: RescueRecord = {
          id: `rescue-${Date.now()}`,
          timestamp,
          snippetText,
          plainChineseExplanation: data.rescueData.plainChineseExplanation,
          sentenceDeconstruction: data.rescueData.sentenceDeconstruction,
          suggestedQuestion: data.rescueData.suggestedQuestion,
          analogy: data.rescueData.analogy,
          keyVocab: data.rescueData.keyVocab || [],
        };
        onSaveRescueRecord(record);
      }
    } catch (err) {
      console.error("Rescue analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card border border-rose-500/40 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 rescue-glow">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-rose-950/80 via-black/60 to-black/60 p-5 border-b border-rose-500/30 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-400/30 animate-pulse">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">听力救生圈 · 30秒深度拆解</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono border border-rose-400/20">
                  [{timestamp}]
                </span>
              </div>
              <p className="text-xs text-slate-300">已自动捕捉并留存当前卡壳片段，为你进行中文降负与语法拆解</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
          
          {/* Captured Snippet Box */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              捕捉的讲课原音转录:
            </span>
            <p className="text-sm font-mono text-amber-200/90 leading-relaxed italic">
              "{snippetText}"
            </p>
          </div>

          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">
                AI 正在生成通俗中文解释、语法分解与课堂发问句型...
              </p>
            </div>
          ) : rescueData ? (
            <div className="space-y-5">
              
              {/* 1. Plain Chinese Explanation */}
              <div className="bg-indigo-950/60 border border-indigo-400/30 rounded-xl p-4 space-y-2 backdrop-blur-md">
                <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>教授到底在表达什么 (通俗中文核心含义):</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-medium">
                  {rescueData.plainChineseExplanation}
                </p>
              </div>

              {/* 2. Sentence Structure Breakdown */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2 backdrop-blur-md">
                <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>句子与口语连读拆解 (Why it felt difficult):</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {rescueData.sentenceDeconstruction}
                </p>
              </div>

              {/* 3. Key Vocab Breakdown */}
              {rescueData.keyVocab && rescueData.keyVocab.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2 backdrop-blur-md">
                  <span className="text-xs font-bold text-emerald-400 block mb-2">
                    片段内高频词汇拆解:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rescueData.keyVocab.map((item: any, i: number) => (
                      <div key={i} className="p-2 bg-white/5 rounded-lg border border-white/10 text-xs">
                        <span className="font-semibold text-cyan-300 font-mono">{item.term}</span>
                        <span className="ml-2 text-emerald-400">({item.chinese})</span>
                        {item.explanation && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Analogy */}
              {rescueData.analogy && (
                <div className="p-3 bg-amber-950/40 border border-amber-400/30 rounded-xl text-xs text-amber-200 backdrop-blur-md">
                  <span className="font-bold block mb-1">💡 通俗生活比喻:</span>
                  <p className="leading-relaxed">{rescueData.analogy}</p>
                </div>
              )}

              {/* 5. Suggested Question for Professor/TA */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2 backdrop-blur-md">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                  <MessageCircle className="w-4 h-4" />
                  <span>向教授/TA发问的标准地道英文句型 (提问不害羞):</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-emerald-300">
                  "{rescueData.suggestedQuestion}"
                </div>
              </div>

            </div>
          ) : (
            <p className="text-xs text-rose-400 text-center py-4">
              拆解生成失败，请重试。
            </p>
          )}

        </div>

        {/* Footer */}
        <div className="bg-black/60 p-4 border-t border-white/10 flex items-center justify-between backdrop-blur-md">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>已自动存入右侧“救生圈历史”，方便课后重点复习</span>
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium transition-colors border border-white/15"
          >
            完成并继续听课
          </button>
        </div>

      </div>
    </div>
  );
};
