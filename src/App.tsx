/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Rocket, Trophy, AlertCircle, RotateCcw, Languages } from 'lucide-react';
import { GameEngine } from './game/engine';
import { cn } from './lib/utils';

type Language = 'en' | 'zh';

const TRANSLATIONS = {
  en: {
    title: 'Felix Star Defense',
    score: 'Score',
    ammo: 'Ammo',
    win: 'Mission Accomplished!',
    lose: 'Defense Line Breached',
    restart: 'Play Again',
    instructions: 'Click to intercept. Missiles will automatically track nearby enemies! Right-click or use buttons to fire Grenades (costs 5 ammo)!',
    winDesc: 'You have successfully defended the sector.',
    loseDesc: 'All batteries destroyed. The cities have fallen.',
    lang: '中文',
    missile: 'Missile',
    grenade: 'Grenade'
  },
  zh: {
    title: 'Felix 星际防御',
    score: '得分',
    ammo: '弹药',
    win: '任务圆满完成！',
    lose: '防线已被攻破',
    restart: '再玩一次',
    instructions: '点击拦截。导弹会自动追踪附近的敌人！右键或使用按钮发射手雷（消耗5发弹药）！',
    winDesc: '你成功保卫了该星区。',
    loseDesc: '所有炮台已被摧毁。城市沦陷。',
    lang: 'English',
    missile: '导弹',
    grenade: '手雷'
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  // Use refs to track values and prevent redundant state updates in the 60fps loop
  const lastScoreRef = useRef(0);
  const lastAmmoRef = useRef<number[]>([]);
  const reportedStateRef = useRef<'playing' | 'win' | 'lose'>('playing');

  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState<number[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'win' | 'lose'>('playing');
  const [lang, setLang] = useState<Language>('zh');
  const [weapon, setWeapon] = useState<'missile' | 'grenade'>('missile');

  const t = TRANSLATIONS[lang];

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 600;

    if (!engineRef.current) {
      engineRef.current = new GameEngine(canvas.width, canvas.height);
    } else {
      engineRef.current.reset();
    }
    
    // Reset refs
    lastScoreRef.current = 0;
    lastAmmoRef.current = engineRef.current.batteries.map(b => b.ammo);
    reportedStateRef.current = 'playing';

    setGameState('playing');
    setScore(0);
    setAmmo(lastAmmoRef.current);
  }, []);

  // Separate initialization from the game loop to ensure it only runs when canvas is ready
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      initGame();
    }
  }, [initGame]);

  useEffect(() => {
    let animationFrameId: number;
    const render = (time: number) => {
      try {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        
        if (engine && canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            engine.update(time);
            engine.draw(ctx);
            
            // 1. Sync Score (only if changed)
            if (engine.score !== lastScoreRef.current) {
              setScore(engine.score);
              lastScoreRef.current = engine.score;
            }
            
            // 2. Sync Ammo (only if changed)
            const currentAmmo = engine.batteries.map(b => b.ammo);
            const ammoChanged = currentAmmo.some((val, idx) => val !== lastAmmoRef.current[idx]);
            if (ammoChanged) {
              setAmmo(currentAmmo);
              lastAmmoRef.current = currentAmmo;
            }
            
            // 3. Sync Game State (only on transition)
            if (engine.gameWin && reportedStateRef.current !== 'win') {
              setGameState('win');
              reportedStateRef.current = 'win';
            } else if (engine.gameOver && reportedStateRef.current !== 'lose') {
              setGameState('lose');
              reportedStateRef.current = 'lose';
            }
          }
        }
      } catch (error) {
        console.error("Game Loop Error:", error);
        // Prevent total crash, just skip this frame
      }
      animationFrameId = requestAnimationFrame(render);
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Run loop once on mount

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;
    
    // Prevent context menu on right click
    if ('button' in e && e.button === 2) {
      e.preventDefault();
    }

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    let isRightClick = false;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      const mouseEvent = e as React.MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
      isRightClick = mouseEvent.button === 2;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    const useGrenade = isRightClick || weapon === 'grenade';
    engineRef.current.fireMissile(x, y, useGrenade);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 md:p-6 flex justify-between items-center border-b border-white/10 bg-black/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
              Sector 7-G Defense Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium"
          >
            <Languages className="w-4 h-4" />
            {t.lang}
          </button>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{t.score}</span>
            <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
              {score.toString().padStart(5, '0')}
            </span>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-4xl aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5 group">
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasClick}
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={(e) => {
              e.preventDefault();
              handleCanvasClick(e);
            }}
            className="w-full h-full cursor-crosshair touch-none"
          />

          {/* Weapon Selector */}
          <div className="absolute top-4 left-4 flex gap-2">
            <button
              onClick={() => setWeapon('missile')}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                weapon === 'missile' 
                  ? "bg-emerald-500 border-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
                  : "bg-black/60 border-white/10 text-white/60 hover:bg-white/5"
              )}
            >
              {t.missile}
            </button>
            <button
              onClick={() => setWeapon('grenade')}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                weapon === 'grenade' 
                  ? "bg-orange-500 border-orange-400 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)]" 
                  : "bg-black/60 border-white/10 text-white/60 hover:bg-white/5"
              )}
            >
              {t.grenade}
            </button>
          </div>

          {/* Mobile Score Overlay */}
          <div className="md:hidden absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
            <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
              {score}
            </span>
          </div>

          {/* Ammo HUD */}
          <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-between pointer-events-none">
            {ammo.map((count, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div 
                      key={j} 
                      className={cn(
                        "w-1 h-4 rounded-full transition-colors",
                        count > (j * 40) ? "bg-orange-500" : "bg-white/10"
                      )} 
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-white/60 uppercase tracking-tighter">
                  {t.ammo} {count}
                </span>
              </div>
            ))}
          </div>

          {/* Game Over / Win Overlays */}
          <AnimatePresence>
            {gameState !== 'playing' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
              >
                <div className="max-w-md w-full text-center space-y-6">
                  <div className="flex justify-center">
                    {gameState === 'win' ? (
                      <div className="p-4 bg-emerald-500/20 rounded-full border border-emerald-500/40">
                        <Trophy className="w-12 h-12 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="p-4 bg-red-500/20 rounded-full border border-red-500/40">
                        <AlertCircle className="w-12 h-12 text-red-400" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h2 className={cn(
                      "text-3xl font-bold tracking-tight",
                      gameState === 'win' ? "text-emerald-400" : "text-red-400"
                    )}>
                      {gameState === 'win' ? t.win : t.lose}
                    </h2>
                    <p className="text-white/60">
                      {gameState === 'win' ? t.winDesc : t.loseDesc}
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-sm text-white/40 uppercase tracking-widest font-bold mb-1">{t.score}</p>
                    <p className="text-4xl font-mono font-bold text-white">{score}</p>
                  </div>

                  <button
                    onClick={initGame}
                    className="w-full group relative flex items-center justify-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-emerald-400 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    {t.restart}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center max-w-lg">
          <p className="text-sm text-white/40 leading-relaxed">
            {t.instructions}
          </p>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="p-4 border-t border-white/5 bg-black/30 flex justify-center gap-8">
        <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-[0.2em]">
          <Target className="w-3 h-3" />
          <span>Active Defense</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-[0.2em]">
          <Rocket className="w-3 h-3" />
          <span>Interceptors Ready</span>
        </div>
      </footer>
    </div>
  );
}
