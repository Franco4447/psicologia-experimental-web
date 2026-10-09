/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import type { AdminDashboardStats } from '@/types/experiment';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setIsAuthenticated(true);
        setDashboardError('');
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
        setDashboardError('Error al cargar las estadísticas del servidor.');
      }
    } catch (err) {
      console.error(err);
      setIsAuthenticated(true);
      setDashboardError('Error de red al intentar conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const sortedParticipants = React.useMemo(() => {
    if (!stats) return [];
    const sortableItems = [...stats.participantsList];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        if (aVal === null) aVal = '';
        if (bVal === null) bVal = '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [stats, sortConfig]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (res.ok) {
        setIsAuthenticated(true);
        fetchStats();
      } else if (res.status === 401) {
        setError('Contraseña incorrecta');
      } else {
        setError('Error del servidor al intentar iniciar sesión');
      }
    } catch (err) {
      setError('Error de red al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition disabled:opacity-50 flex items-center justify-center">
            {isSubmitting ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
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
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/admin/export-xlsx"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded shadow transition inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Exportar Excel (participantes)
            </a>
            <a
              href="/api/admin/export-csv"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow transition inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Exportar Datos CSV
            </a>
          </div>
        </div>

        {dashboardError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{dashboardError}</span>
          </div>
        )}

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
          <div className="space-y-6">
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

              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Razones de Exclusión</h3>
                {Object.keys(stats.exclusionBreakdown).length > 0 ? (
                  <ul className="space-y-2">
                    {Object.entries(stats.exclusionBreakdown).map(([reason, count]) => (
                      <li key={reason} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{reason}</span>
                        <span className="font-semibold">{count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No hay exclusiones registradas.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">KPIs Globales (Incluidos y Completos)</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between">
                    <span className="text-slate-600">Tasa de Falsos Recuerdos</span>
                    <span className="font-semibold text-red-600">{stats.kpis.overall.falseMemoryRate.toFixed(1)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Tasa de Falsas Creencias</span>
                    <span className="font-semibold text-amber-600">{stats.kpis.overall.falseBeliefRate.toFixed(1)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Tasa de Memorias Verdaderas</span>
                    <span className="font-semibold text-green-600">{stats.kpis.overall.trueMemoryRate.toFixed(1)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Tiempo de lectura prom.</span>
                    <span className="font-semibold">{(stats.kpis.overall.avgReadingTimeMs / 1000).toFixed(2)} s</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Tiempo de rta prom.</span>
                    <span className="font-semibold">{(stats.kpis.overall.avgResponseTimeMs / 1000).toFixed(2)} s</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Demografía</h3>
                {stats.demographics.age && stats.demographics.age.mean > 0 && (
                  <div className="mb-4 text-sm space-y-1">
                    <p><span className="text-slate-600 font-medium">Edad Promedio:</span> {stats.demographics.age.mean.toFixed(1)} (SD: {stats.demographics.age.sd.toFixed(1)})</p>
                    <p><span className="text-slate-600 font-medium">Rango de Edades:</span> {stats.demographics.age.min} - {stats.demographics.age.max}</p>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-slate-600 font-medium block mb-1">Género:</span>
                  <ul className="pl-4 space-y-1">
                    {Object.entries(stats.demographics.gender).map(([gender, count]) => (
                      <li key={gender} className="flex justify-between max-w-[200px]">
                        <span>{gender}</span>
                        <span className="font-semibold">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow overflow-hidden">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">KPIs por Grupo</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Grupo</th>
                      <th className="px-4 py-3 font-semibold">Falsos Recuerdos</th>
                      <th className="px-4 py-3 font-semibold">Falsas Creencias</th>
                      <th className="px-4 py-3 font-semibold">Memoria Verdadera</th>
                      <th className="px-4 py-3 font-semibold">T. Lectura (s)</th>
                      <th className="px-4 py-3 font-semibold">T. Respuesta (s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {['racional', 'emocional', 'control'].map(grp => {
                      const data = stats.kpis.byGroup[grp];
                      if (!data) return null;
                      return (
                        <tr key={grp}>
                          <td className="px-4 py-3 font-medium capitalize">{grp}</td>
                          <td className="px-4 py-3 text-red-600">{data.falseMemoryRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-amber-600">{data.falseBeliefRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-green-600">{data.trueMemoryRate.toFixed(1)}%</td>
                          <td className="px-4 py-3">{(data.avgReadingTimeMs / 1000).toFixed(2)}</td>
                          <td className="px-4 py-3">{(data.avgResponseTimeMs / 1000).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow mt-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Chequeo de Manipulación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Inducción Reportada (Self-Report)</h4>
                  <ul className="space-y-2 text-sm border p-4 rounded bg-slate-50">
                    {Object.entries(stats.manipulationCheck.reportedInduction).map(([key, count]) => (
                      <li key={key} className="flex justify-between items-center">
                        <span className="text-slate-600">{key}</span>
                        <span className="font-semibold">{count}</span>
                      </li>
                    ))}
                    {Object.keys(stats.manipulationCheck.reportedInduction).length === 0 && (
                       <li className="text-slate-500">Sin datos</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Uso Reportado por Grupo (1-7)</h4>
                  <div className="space-y-3 text-sm">
                    {['racional', 'emocional', 'control'].map(grp => {
                      const data = stats.manipulationCheck.scoresByGroup[grp];
                      if (!data) return null;
                      return (
                        <div key={grp} className="border-b pb-2 last:border-0">
                          <div className="capitalize font-medium mb-1 text-slate-800">{grp}</div>
                          <div className="flex justify-between text-slate-600">
                            <span>Uso de Emoción:</span>
                            <span className="font-semibold">{data.avgEmotionUsage > 0 ? data.avgEmotionUsage.toFixed(2) : '-'}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Uso de Razón:</span>
                            <span className="font-semibold">{data.avgReasonUsage > 0 ? data.avgReasonUsage.toFixed(2) : '-'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Detalle de Participantes</h3>
              <div className="overflow-x-auto h-96 border rounded">
                <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('id')}>ID {sortConfig?.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('status')}>Status {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('isIncluded')}>Inc? {sortConfig?.key === 'isIncluded' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('inductionGroup')}>Grupo {sortConfig?.key === 'inductionGroup' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('age')}>Edad {sortConfig?.key === 'age' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('gender')}>Género {sortConfig?.key === 'gender' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('therapeuticOrientation')}>Orientación {sortConfig?.key === 'therapeuticOrientation' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('exclusionReason')}>Razón Excl. {sortConfig?.key === 'exclusionReason' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => requestSort('completedAt')}>Completado {sortConfig?.key === 'completedAt' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sortedParticipants.map(p => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 font-mono text-xs">{p.id}</td>
                        <td className="px-4 py-2">{p.status}</td>
                        <td className="px-4 py-2">{p.isIncluded ? 'Sí' : 'No'}</td>
                        <td className="px-4 py-2 capitalize">{p.inductionGroup}</td>
                        <td className="px-4 py-2">{p.age}</td>
                        <td className="px-4 py-2">{p.gender}</td>
                        <td className="px-4 py-2 truncate max-w-[150px]" title={p.therapeuticOrientation === 'Basada en Evidencia Científica' ? 'Cognitivo-Conductual' : p.therapeuticOrientation}>
                          {p.therapeuticOrientation === 'Basada en Evidencia Científica' ? 'Cognitivo-Conductual' : p.therapeuticOrientation}
                        </td>
                        <td className="px-4 py-2 text-xs text-red-600">{p.exclusionReason || '-'}</td>
                        <td className="px-4 py-2 text-xs">{p.completedAt ? new Date(p.completedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
