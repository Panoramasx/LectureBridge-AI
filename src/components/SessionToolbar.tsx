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
    <div className="session-strip">
      <div className="session-strip-inner">
        <span className="session-label">{sessionLabel}</span>
        <div className="session-actions">
          <button aria-label="新建课堂" onClick={onNewSession} title="新建课堂" className="icon-action">
            <Plus className="w-4 h-4" />
          </button>
          <button aria-label="导出 Markdown" onClick={onExportMarkdown} title="导出 Markdown" className="icon-action">
            <Download className="w-4 h-4" />
          </button>
          <button aria-label="导出 JSON 备份" onClick={onExportJson} title="导出 JSON 备份" className="icon-action">
            <FileJson className="w-4 h-4" />
          </button>
          <button aria-label="导入 JSON 备份" onClick={() => inputRef.current?.click()} title="导入 JSON 备份" className="icon-action">
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
