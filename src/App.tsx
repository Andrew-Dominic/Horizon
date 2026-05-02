/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { oceanFragmentShader, oceanVertexShader } from './shaders';
import * as THREE from 'three';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Menu, X, ArrowRight } from 'lucide-react';

// WebGL Background Component
function OceanBackground({ scrollY, isMouseDown }: { scrollY: number, isMouseDown: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, viewport } = useThree();
  const lastClickPos = useRef(new THREE.Vector2(0, 0));

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(size.width, size.height, 1) },
      iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
      iScroll: { value: 0 },
    }),
    []
  );

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    uniforms.iResolution.value.set(size.width * dpr, size.height * dpr, 1);
  }, [size, uniforms]);

  useEffect(() => {
    if (isMouseDown) {
      const dpr = window.devicePixelRatio || 1;
      // Note: we don't have access to mouse event here, 
      // but the shader iMouse expects it. 
      // We'll update click pos in the frame loop if isMouseDown is true and it was false.
    }
  }, [isMouseDown]);

  useFrame((state) => {
    const { clock, mouse } = state;
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      const dpr = window.devicePixelRatio || 1;
      material.uniforms.iTime.value = clock.getElapsedTime();
      material.uniforms.iScroll.value = scrollY;
      
      const mouseX = (mouse.x + 1) * 0.5 * size.width * dpr;
      const mouseY = (mouse.y + 1) * 0.5 * size.height * dpr;
      
      if (isMouseDown && material.uniforms.iMouse.value.z <= 0) {
        lastClickPos.current.set(mouseX, mouseY);
      }

      // iMouse: x, y, clickX, clickY
      material.uniforms.iMouse.value.set(
        mouseX, 
        mouseY, 
        isMouseDown ? lastClickPos.current.x : -Math.abs(lastClickPos.current.x),
        isMouseDown ? lastClickPos.current.y : -Math.abs(lastClickPos.current.y)
      );
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
      <shaderMaterial
        fragmentShader={oceanFragmentShader}
        vertexShader={oceanVertexShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// Ambient Procedural Audio Component
function DeepSeaAudio({ scrollY }: { scrollY: number }) {
  const audioContext = useRef<AudioContext | null>(null);
  const filterNode = useRef<BiquadFilterNode | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleStart = () => {
      if (!audioContext.current) {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioCtx) return;
        
        audioContext.current = new AudioCtx();
        setIsActive(true);
        
        // 1. The Abyss - Heavy Brown Noise
        const bufferSize = audioContext.current.sampleRate * 2;
        const noiseBuffer = audioContext.current.createBuffer(1, bufferSize, audioContext.current.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 4.0;
        }

        const noiseSource = audioContext.current.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        filterNode.current = audioContext.current.createBiquadFilter();
        filterNode.current.type = 'lowpass';
        filterNode.current.frequency.value = 600;
        filterNode.current.Q.value = 2.0;

        // 2. The Pulse - Deep Sine Oscillator
        const osc = audioContext.current.createOscillator();
        const oscGain = audioContext.current.createGain();
        osc.type = 'sine';
        osc.frequency.value = 32.7; // C1 - Deep Sub
        oscGain.gain.value = 0.4;

        // Connections
        gainNode.current = audioContext.current.createGain();
        gainNode.current.gain.value = 0.1; // Moderate volume

        noiseSource.connect(filterNode.current);
        filterNode.current.connect(gainNode.current);
        osc.connect(oscGain);
        oscGain.connect(gainNode.current);
        
        gainNode.current.connect(audioContext.current.destination);

        noiseSource.start();
        osc.start();
      }
      
      if (audioContext.current.state === 'suspended') {
        audioContext.current.resume();
      }
    };

    window.addEventListener('mousedown', handleStart, { once: true });
    window.addEventListener('touchstart', handleStart, { once: true });
    return () => {
      window.removeEventListener('mousedown', handleStart);
      window.removeEventListener('touchstart', handleStart);
    };
  }, []);

  useEffect(() => {
    if (filterNode.current && audioContext.current && gainNode.current) {
      // Deeper as we scroll
      const t = audioContext.current.currentTime;
      const freq = 800 - (scrollY * 700);
      filterNode.current.frequency.setTargetAtTime(Math.max(60, freq), t, 0.5);
      
      const vol = 0.1 + (scrollY * 0.15);
      gainNode.current.gain.setTargetAtTime(vol, t, 0.5);
    }
  }, [scrollY]);

  return (
    <AnimatePresence>
      {!isActive && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] py-2 px-4 border border-white/10 backdrop-blur-md text-[8px] tracking-[0.4em] uppercase text-white/40 pointer-events-none"
        >
          Click to enable atmospheric audio
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const Header = () => {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 p-12 flex justify-between items-center mix-blend-difference pointer-events-auto">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 text-2xl font-bold tracking-tighter text-white drop-shadow-lg"
      >
        <img 
          src="/diagram.svg" 
          className="w-10 h-10" 
          alt="Thalassa Logo"
        />
        <span>THALASSA</span>
      </motion.div>
    </nav>
  );
};

const Hero = () => {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-6 select-none pointer-events-none">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-[10px] tracking-[0.4em] uppercase text-white/70 mb-6"
      >
        A Hymn for the Unseen
      </motion.span>
      <motion.h1 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-[15vw] md:text-[120px] leading-[0.9] font-display text-white mb-10"
      >
        BEYOND THE<br/>HORIZON
      </motion.h1>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md space-y-10"
      >
        <p className="text-lg text-white leading-relaxed font-light italic drop-shadow-xl">
          "The horizon is not a boundary, but an invitation to witness the infinite."
        </p>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="pointer-events-auto px-12 py-4 border border-white/20 text-white text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-white hover:text-black transition-all duration-700 backdrop-blur-sm"
        >
          Begin the Descent
        </motion.button>
      </motion.div>
    </div>
  );
};

const PoeticCanto = ({ text }: { text: string }) => (
  <section className="h-[50vh] flex items-center justify-center px-12">
    <motion.p 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 2.5 }}
      className="text-white/90 text-sm md:text-xl font-light italic tracking-widest text-center max-w-2xl leading-loose drop-shadow-2xl"
    >
      {text}
    </motion.p>
  </section>
);

const NarrativeSection = ({ number, title, text, align = 'left' }: { number: string, title: string, text: string, align?: 'left' | 'right' }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className={`min-h-screen flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} px-12 md:px-32 pointer-events-none overflow-hidden}`}>
      <motion.div 
        style={{ y, opacity }}
        className="max-w-xl text-white space-y-8"
      >
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-[0.5em] text-white/70">{number}</span>
          <div className="h-[1px] w-12 bg-white/20" />
        </div>
        <h2 className="text-5xl md:text-8xl font-display leading-[0.85] drop-shadow-2xl">{title}</h2>
        <p className="text-xl font-light text-white/90 leading-relaxed max-w-sm drop-shadow-lg">
          {text}
        </p>
      </motion.div>
    </section>
  );
};

const GlassCard = ({ title, value, label, index }: { title: string, value: string, label: string, index: number }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end center"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);

  return (
    <motion.div 
      ref={ref}
      style={{ y, opacity, scale }}
      className="group relative p-8 md:p-12 bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:bg-white/[0.06] hover:border-white/20 transition-all duration-700 flex flex-col justify-between aspect-square md:aspect-auto md:h-80"
    >
      <div className="space-y-4">
        <span className="text-[10px] tracking-[0.4em] text-white/70 uppercase drop-shadow-sm">{label}</span>
        <h3 className="text-2xl font-display text-white/95 drop-shadow-md">{title}</h3>
      </div>
      <div className="text-4xl font-mono text-white/40 group-hover:text-white/60 transition-colors duration-700 drop-shadow-sm">
        {value}
      </div>
    </motion.div>
  );
};

const FeatureGrid = () => (
  <section className="px-12 md:px-32 py-32 space-y-24">
    <div className="max-w-2xl space-y-6">
      <div className="h-[1px] w-24 bg-white/20" />
      <h2 className="text-4xl md:text-6xl font-display text-white">Echoes of<br/>the Infinite</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <GlassCard index={0} label="Breath" title="The Tidal Pulse" value="Eternal" />
      <GlassCard index={1} label="Spirit" title="Ephemeral Sculptures" value="Liquid" />
      <GlassCard index={2} label="Memory" title="Voices in the Blue" value="Infinite" />
    </div>
  </section>
);

const FooterLink = ({ children }: { children: React.ReactNode }) => (
  <motion.li 
    whileHover={{ x: 8, color: "rgba(255,255,255,1)" }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    className="cursor-pointer w-fit"
  >
    {children}
  </motion.li>
);

const MainFooter = () => (
  <footer className="relative pt-24 pb-12 md:pt-48 md:pb-24 px-6 md:px-32 bg-black">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 border-t border-white/5 pt-12 md:pt-24 relative z-10">
      <div className="space-y-6 md:space-y-8">
        <h3 className="text-xl font-display text-white">The Salt & Soul</h3>
        <p className="text-sm text-white/80 leading-relaxed max-w-xs font-light drop-shadow-sm">
          A pilgrimage into the blue. A tribute to the great horizon that divides the world of man from the world of wonder.
        </p>
      </div>
      
      <div className="space-y-4 md:space-y-6">
        <span className="text-[10px] tracking-[0.4em] text-white/60 uppercase font-bold">Navigation</span>
        <ul className="space-y-3 md:space-y-4 text-sm text-white/80">
          <FooterLink>The Journey</FooterLink>
          <FooterLink>Algorithm</FooterLink>
          <FooterLink>Chronicles</FooterLink>
        </ul>
      </div>

      <div className="space-y-4 md:space-y-6">
        <span className="text-[10px] tracking-[0.4em] text-white/60 uppercase font-bold">Connect</span>
        <ul className="space-y-3 md:space-y-4 text-sm text-white/80">
          <FooterLink>Observatory</FooterLink>
          <FooterLink>Satellite Feed</FooterLink>
          <FooterLink>Direct Comm</FooterLink>
        </ul>
      </div>

      <div className="space-y-6 md:space-y-8 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="text-[10px] text-white/30 tracking-[0.2em]">CURRENT_LOC</div>
          <div className="text-xs font-mono text-white/60 uppercase">43.6532N // 79.3832W</div>
        </div>
        <div className="text-[10px] text-white/20 tracking-[0.4em]">MMXXIV - MMXXV // NO DATA LEAK</div>
      </div>
    </div>
    
    <div className="mt-24 md:mt-48 flex justify-center">
      <h2 className="text-[20vw] md:text-[18vw] font-display text-white/20 leading-none select-none drop-shadow-2xl">
        HORIZON
      </h2>
    </div>
  </footer>
);

const DepthIndicator = ({ scrollY }: { scrollY: number }) => (
  <div className="fixed right-12 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col items-center gap-6 pointer-events-none">
    <span className="text-[10px] tracking-[0.3em] text-white/60 uppercase vertical-text rotate-180 drop-shadow-sm">Surface</span>
    <div className="h-48 w-[1px] bg-white/20 relative">
      <motion.div 
        className="absolute top-0 left-0 w-full bg-white/80"
        style={{ height: `${scrollY * 100}%` }}
      />
    </div>
    <span className="text-[10px] tracking-[0.3em] text-white/60 uppercase vertical-text rotate-180 drop-shadow-sm">Abyss</span>
    <div className="text-[10px] font-mono text-white/50 tabular-nums drop-shadow-sm">
      {Math.floor(scrollY * 4000)}M
    </div>
  </div>
);

const Footer = () => null;

export default function App() {
  const [scrollY, setScrollY] = useState(0);
  const [isMouseDown, setIsMouseDown] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY / (maxScroll || 1);
      setScrollY(currentScroll);
    };

    const handleDown = () => setIsMouseDown(true);
    const handleUp = () => setIsMouseDown(false);

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  return (
    <div className="relative bg-black font-sans selection:bg-white selection:text-black overflow-x-hidden min-h-screen">
      <DeepSeaAudio scrollY={scrollY} />
      {/* WebGL Layer - Fixed Background */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
        <Canvas 
          flat 
          orthographic
          dpr={[1, 1.5]} 
          camera={{ zoom: 1, position: [0, 0, 1] }}
          gl={{ 
            antialias: false,
            powerPreference: 'high-performance',
            alpha: false
          }}
        >
          <OceanBackground scrollY={scrollY} isMouseDown={isMouseDown} />
        </Canvas>
      </div>

      {/* Content Layer */}
      <Header />
      <DepthIndicator scrollY={scrollY} />
      
      <main className="relative">
        <Hero />
        
        <PoeticCanto text="The sea is a desert of waves, a wilderness where the self dissolves into the sublime." />

        <NarrativeSection 
          number="I" 
          title="The Interface" 
          text="The surface is a lie we agree upon—a thin, shimmering veil where the known world touches the infinite unknown."
        />

        <NarrativeSection 
          number="II" 
          title="Weight of Grace" 
          text="To descend is to unlearn the heavy logic of the shore. Here, gravity is replaced by grace, and light is surrendered to the wisdom of shadow."
          align="right"
        />

        <PoeticCanto text="Time does not pass here; it only returns. The tide is the heartbeat of a world that was old before we learned to dream." />

        <NarrativeSection 
          number="III" 
          title="Primordial Pulse" 
          text="In the absolute dark of the abyss, we find an internal light—the bioluminescent sparks of a consciousness that predates the sun."
        />

        <FeatureGrid />

        <section className="h-[50vh] flex flex-col items-center justify-center pointer-events-none select-none">
          <motion.div
             initial={{ opacity: 0 }}
             whileInView={{ opacity: 1 }}
             transition={{ duration: 2 }}
             className="text-white/20 text-[10px] tracking-[0.8em] font-light uppercase italic"
          >
            The tide is coming in
          </motion.div>
        </section>

        <MainFooter />
      </main>

      <Footer />

      <style>{`
        body {
          margin: 0;
          padding: 0;
          background: #000;
          overflow-x: hidden;
        }
        #root {
          width: 100%;
          min-height: 100vh;
        }
        ::-webkit-scrollbar {
          width: 0px;
        }
        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
}
