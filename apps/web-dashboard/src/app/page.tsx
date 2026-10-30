"use client";

import { motion } from "framer-motion";
import { Camera, MapPin, Fingerprint, Calendar, Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function Home() {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 bg-slate-50">
      {/* Background glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[60vw] h-[20vw] rounded-full bg-purple-400/10 blur-[100px] pointer-events-none" />

      <motion.div 
        className="z-10 w-full max-w-md glass-panel rounded-3xl p-8 flex flex-col items-center shadow-xl border border-white/60 relative bg-white/80"
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
      >
        {/* Header */}
        <motion.div 
          className="w-full flex justify-between items-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Fingerprint className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 leading-none">HDIR</h1>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Attendance App</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-700 tracking-widest">{currentTime || "--:--:--"}</p>
            <p className="text-xs text-slate-500 font-medium">Time</p>
          </div>
        </motion.div>

        {/* Status indicator */}
        <motion.div 
          className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 mb-8 shadow-sm"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-400 rounded-full blur-md opacity-40 animate-pulse" />
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center relative z-10 shadow-md">
              <MapPin className="text-white w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-emerald-700 font-bold">Siap Digunakan</h3>
            <p className="text-sm text-emerald-600/80">Masuk lewat dashboard untuk absen dengan GPS &amp; verifikasi wajah</p>
          </div>
        </motion.div>

        {/* Action Grid */}
        <motion.div 
          className="grid grid-cols-2 gap-4 w-full mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.a
            href="/login"
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 shadow-sm rounded-2xl gap-3 group overflow-hidden hover:shadow-md hover:bg-blue-50 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
              <Camera className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-700">Check In</span>
          </motion.a>
          
          <motion.a
            href="/login"
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 shadow-sm rounded-2xl gap-3 group overflow-hidden hover:shadow-md hover:bg-purple-50 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300 shadow-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-700">Leave</span>
          </motion.a>
        </motion.div>

        {/* Activity: no fake history is shown on this public page.
            Real attendance appears after login, on the HR dashboard. */}
        <motion.div
          className="w-full flex flex-col gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mulai dari sini</h4>

          <motion.a
            href="/login"
            variants={itemVariants}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Masuk ke Dashboard HR</p>
                <p className="text-xs text-slate-500">Lihat rekap kehadiran hari ini &amp; persetujuan</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </motion.a>

          <motion.div variants={itemVariants} className="flex items-center gap-3 p-3 rounded-xl border border-transparent">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Absen dari aplikasi mobile</p>
              <p className="text-xs text-slate-500">GPS + foto selfie + verifikasi wajah, dari HP karyawan</p>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Footer hint */}
      <motion.p 
        className="absolute bottom-6 text-xs text-slate-400 font-medium"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        AI-Powered Recognition & Geofencing System
      </motion.p>
    </main>
  );
}
