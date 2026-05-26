"use client";

import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
  phaseSpeed: number;
  amplitude: number;
}

export default function BackgroundEffects() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const isHoveredRef = useRef(false);

  useEffect(() => {
    // 1. Mouse movement tracking for grid spotlight
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      
      mouseRef.current = { x: e.clientX, y: e.clientY };
      isHoveredRef.current = true;

      // Update CSS variables for CSS spotlight grid
      container.style.setProperty("--mouse-x", `${e.clientX}px`);
      container.style.setProperty("--mouse-y", `${e.clientY}px`);
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      const container = containerRef.current;
      if (container) {
        // Position offscreen when mouse leaves
        container.style.setProperty("--mouse-x", `-1000px`);
        container.style.setProperty("--mouse-y", `-1000px`);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // 2. Canvas Dust Particles
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const initParticles = () => {
      particles = [];
      const count = Math.min(60, Math.floor((width * height) / 25000)); // Dynamic density
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: -(Math.random() * 0.18 + 0.08), // Upward floating speed
          size: Math.random() * 1.3 + 0.5, // Small granulated dust
          opacity: Math.random() * 0.22 + 0.04, // Subtle opacity
          phase: Math.random() * Math.PI * 2,
          phaseSpeed: Math.random() * 0.01 + 0.003,
          amplitude: Math.random() * 1.5 + 0.5,
        });
      }
    };

    initParticles();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (document.body) {
      resizeObserver.observe(document.body);
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const hasMouse = isHoveredRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Normal Drift
        p.y += p.vy;
        p.phase += p.phaseSpeed;
        const sway = Math.sin(p.phase) * p.amplitude;

        // Apply horizontal drift velocity
        p.x += p.vx;

        // Pointer Repulsion (Dust reacting to mouse movements)
        if (hasMouse) {
          const dx = p.x + sway - mx;
          const dy = p.y - my;
          const dist = Math.hypot(dx, dy);
          const repelRadius = 140;

          if (dist < repelRadius) {
            const force = (repelRadius - dist) / repelRadius; // 0 (far) to 1 (close)
            const angle = Math.atan2(dy, dx);
            
            // Gently push dust particles outward
            const pushX = Math.cos(angle) * force * 1.8;
            const pushY = Math.sin(angle) * force * 1.8;

            p.x += pushX;
            p.y += pushY;
          }
        }

        // Boundary Reset
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x + sway, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.shadowBlur = p.size > 1 ? 2 : 0;
        ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-black"
      style={{
        "--mouse-x": "-1000px",
        "--mouse-y": "-1000px",
      } as React.CSSProperties}
    >
      {/* 1. Base Dark Background grids */}
      <div className="absolute inset-0 bg-grid opacity-35 pointer-events-none" />
      <div className="absolute inset-0 bg-grid-minor opacity-40 pointer-events-none" />

      {/* 2. Interactive Spotlight Grid (highlights lines under cursor) */}
      <div className="absolute inset-0 bg-grid-spotlight opacity-100 pointer-events-none transition-opacity duration-500" />

      {/* 3. Glowing Blobs (Slow morphing/drifting blur gradient structures) */}
      <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] max-w-[600px] rounded-full bg-purple-600/8 blur-[120px] pointer-events-none animate-blob-1" />
      <div className="absolute top-[25%] right-[-10%] w-[35vw] h-[35vw] max-w-[500px] rounded-full bg-blue-500/5 blur-[110px] pointer-events-none animate-blob-2" />
      <div className="absolute bottom-[10%] left-[10%] w-[40vw] h-[40vw] max-w-[550px] rounded-full bg-fuchsia-600/4 blur-[130px] pointer-events-none animate-blob-3" />
      <div className="absolute bottom-[-15%] right-[15%] w-[35vw] h-[35vw] max-w-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-blob-1" style={{ animationDelay: "-5s" }} />

      {/* 4. Canvas Dust Particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-50" />

      {/* 5. Granulated Animated Film Grain Overlay */}
      <div className="absolute top-[-5%] left-[-5%] w-[110%] h-[110%] bg-grain-animated pointer-events-none opacity-[0.4] mix-blend-overlay" />
      
      {/* 6. Vignette Radial Shadow (fades background components towards screen edges) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_20%,rgba(5,5,5,0.85)_100%)] pointer-events-none" />
    </div>
  );
}
