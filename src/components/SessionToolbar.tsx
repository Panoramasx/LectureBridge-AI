import React, { useRef } from "react";
import { Download, FileJson, FileUp, Plus } from "lucide-react";

interface SessionToolbarProps {
  sessionLabel: string;
  onNewSession: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

export const SessionToolbar: React.FC<SessionToolbarProps> = ({
  sessionLabel,
  onNewSession,
  onExportMarkdown,
  onExportJson,
  onImportJson,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="border-b border-white/10 bg-black/20 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{sessionLabel}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={onNewSession} title="新建课堂" className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={onExportMarkdown} title="导出 Markdown" className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onExportJson} title="导出 JSON 备份" className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">
            <FileJson className="w-4 h-4" />
          </button>
          <button onClick={() => inputRef.current?.click()} title="导入 JSON 备份" className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">
            <FileUp className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportJson(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
};
