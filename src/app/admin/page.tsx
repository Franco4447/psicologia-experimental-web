/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import type { AdminDashboardStats } from '@/types/experiment';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (res.ok) {
        setIsAuthenticated(true);
        fetchStats();
      } else {
        setError('Contraseña incorrecta');
      }
    } catch (err) {
      setError('Error al iniciar sesión');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md max-w-sm w-full">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">Panel de Control</h2>
          {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
          <div className="mb-4">
            <label className="block text-slate-700 text-sm font-bold mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              required
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition">
            Ingresar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Dashboard del Experimento</h1>
          <a 
            href="/api/admin/export-csv" 
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow transition inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Exportar Datos CSV
          </a>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Total Participantes</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.totalParticipants}</p>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Completados</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.completedParticipants} <span className="text-lg text-slate-500 font-normal">({stats.completionRate.toFixed(1)}%)</span></p>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-amber-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Excluidos / Incluidos</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.excludedParticipants} / {stats.includedParticipants}</p>
            </div>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                Asignación de Grupos
                {stats.isBalanced ? (
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Balanceado</span>
                ) : (
                  <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">Desbalanceado (Δ={stats.maxDiscrepancy})</span>
                )}
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">Racional</span>
                    <span>{stats.groups.racional}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(stats.groups.racional / Math.max(1, stats.includedParticipants)) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">Emocional</span>
                    <span>{stats.groups.emocional}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${(stats.groups.emocional / Math.max(1, stats.includedParticipants)) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">Control</span>
                    <span>{stats.groups.control}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-slate-500 h-2 rounded-full" style={{ width: `${(stats.groups.control / Math.max(1, stats.includedParticipants)) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
