import React, { useState } from "react";
import { ShieldAlert, X } from "lucide-react";

export const PrivacyBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <aside className="privacy-banner" aria-label="学术合规与隐私提示">
      <div className="privacy-banner-inner">
        <div className="flex items-start sm:items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>隐私与课堂规范：</strong> 音频仅经自有服务器转接 AI，请遵守所在学校的课堂录音政策。
          </span>
        </div>

        <button
          type="button"
          aria-label="关闭隐私提示"
          onClick={() => setIsDismissed(true)}
          className="icon-action banner-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
