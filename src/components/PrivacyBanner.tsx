import React, { useState } from "react";
import { ShieldAlert, X, Info } from "lucide-react";

export const PrivacyBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="bg-black/30 backdrop-blur-md border-b border-white/10 text-xs py-2 px-4 text-slate-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-slate-100">学术合规与隐私提示:</strong> 本助手仅供中国留学生个人课堂学习辅助使用。原始音频流不上传公共服务器，AI 生成笔记仅供参考，请遵守各校 FERPA / 课堂录音政策。
          </span>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0 hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
