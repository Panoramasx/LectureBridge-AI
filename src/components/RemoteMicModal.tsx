import React, { useState } from "react";
import { Smartphone, QrCode, X, CheckCircle2, ShieldCheck, Wifi, Volume2 } from "lucide-react";

interface RemoteMicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemoteMicModal: React.FC<RemoteMicModalProps> = ({ isOpen, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="glass-card border border-white/15 w-full max-w-md rounded-2xl shadow-2xl p-6 relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-500/20 text-cyan-300 rounded-xl border border-cyan-400/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">手机远程讲台麦克风</h3>
            <p className="text-xs text-slate-400">将手机靠近讲台放于教授桌上，解决阶梯教室回音</p>
          </div>
        </div>

        {!isConnected ? (
          <div className="space-y-4 text-center">
            
            {/* Simulated QR code box */}
            <div className="p-6 bg-white/90 rounded-2xl w-48 h-48 mx-auto flex flex-col items-center justify-center border-4 border-cyan-400/40 shadow-inner backdrop-blur-md">
              <QrCode className="w-32 h-32 text-slate-900" />
              <span className="text-[10px] text-slate-700 font-mono mt-1 font-semibold">扫描二维码一键连接</span>
            </div>

            <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-xs space-y-1 backdrop-blur-md">
              <span className="text-slate-400 block">配对码 (PIN Code):</span>
              <span className="font-mono text-base font-extrabold text-cyan-400 tracking-widest">
                8 8 2 9 - L I V E
              </span>
            </div>

            <button
              onClick={() => setIsConnected(true)}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg border border-cyan-400/30 transition-all"
            >
              模拟手机连接成功
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-pulse">
              <Wifi className="w-8 h-8" />
            </div>

            <div>
              <span className="text-sm font-bold text-emerald-400 block">已成功建立远程音频流</span>
              <p className="text-xs text-slate-400 mt-1">
                iPhone 15 Pro 指向性降噪麦克风传输中 · 延迟 &lt; 180ms
              </p>
            </div>

            <button
              onClick={() => setIsConnected(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs rounded-xl border border-white/10"
            >
              断开连接
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-white/10 flex items-center space-x-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>采用端到端加密音频传输，不留存讲台外杂音</span>
        </div>

      </div>
    </div>
  );
};
