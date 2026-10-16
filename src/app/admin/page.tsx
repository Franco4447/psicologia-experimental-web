/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import type { AdminDashboardStats } from '@/types/experiment';

const GROUPS = ['racional', 'emocional', 'control'] as const;
const GROUP_BAR_COLORS: Record<string, string> = {
  racional: 'bg-blue-600',
  emocional: 'bg-purple-600',
  control: 'bg-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  started: 'En curso',
  reading: 'En curso',
  completed: 'Completada',
  abandoned: 'Abandonada',
};

const EXCLUSION_LABELS: Record<string, string> = {
  menor_de_edad: 'Menor de edad',
  fuera_de_rango_etario: 'Fuera del rango de edad',
  fuera_de_region: 'Fuera de CABA / provincia de Bs. As.',
  no_estudia_psicologia: 'No estudia Psicología',
  orientacion_otros: 'Orientación «Otros»',
  condicion_memoria: 'Condición de memoria',
  dificultad_visual: 'Dificultad visual',
  session_timeout_1h: 'Abandonó (más de 1 h)',
};

const exclusionLabel = (reason: string) => EXCLUSION_LABELS[reason] || reason;

type InferentialAnalysis = AdminDashboardStats['inferential']['analyses'][number];

const TEST_NAMES: Record<string, string> = {
  anova: 'ANOVA de un factor',
  welch: 'ANOVA de Welch',
  kruskal: 'Kruskal-Wallis',
};

/** APA style: no leading zero, three decimals, "< .001" below that. */
function formatP(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '-';
  if (p < 0.001) return '< .001';
  return '= ' + p.toFixed(3).replace(/^0/, '');
}

const formatStat = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '-');
const formatSmall = (v: number) => (Number.isFinite(v) ? v.toFixed(2).replace(/^(-?)0\./, '$1.') : '-');

function SignificanceBadge({ significant }: { significant: boolean }) {
  return significant ? (
    <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Significativa</span>
  ) : (
    <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded">No significativa</span>
  );
}

function InferentialCard({ analysis, alpha }: { analysis: InferentialAnalysis; alpha: number }) {
  const r = analysis.result;
  return (
    <div className="border rounded p-4">
      <h4 className="font-semibold text-slate-800">
        {analysis.label} <span className="text-slate-500 font-normal">({analysis.hypothesis} · {analysis.scale})</span>
      </h4>
      {!r ? (
        <p className="text-sm text-slate-500 mt-2">Hace falta al menos 3 participantes analizados por grupo.</p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="text-slate-600">
                <tr>
                  <th className="pr-4 py-1 font-semibold">Grupo</th>
                  <th className="pr-4 py-1 font-semibold">n</th>
                  <th className="pr-4 py-1 font-semibold">M</th>
                  <th className="pr-4 py-1 font-semibold">DE</th>
                  <th className="pr-4 py-1 font-semibold">Mdn</th>
                  <th className="pr-4 py-1 font-semibold">Shapiro-Wilk</th>
                </tr>
              </thead>
              <tbody>
                {r.groups.map((g, i) => {
                  const sw = r.normality[i];
                  return (
                    <tr key={g.name} className="border-t">
                      <td className="pr-4 py-1 capitalize">{g.name}</td>
                      <td className="pr-4 py-1">{g.n}</td>
                      <td className="pr-4 py-1">{formatStat(g.mean)}</td>
                      <td className="pr-4 py-1">{formatStat(g.sd)}</td>
                      <td className="pr-4 py-1">{formatStat(g.median, 1)}</td>
                      <td className={`pr-4 py-1 ${sw.normal ? 'text-green-700' : 'text-red-600'}`}>
                        {sw.w === null ? 'sin variabilidad' : `W = ${sw.w.toFixed(3)}, p ${formatP(sw.p)}`} {sw.normal ? '✓' : '✗'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 rounded p-3 space-y-1">
            <p>
              <span className="font-medium">Normalidad:</span>{' '}
              {r.allNormal ? 'se cumple en los 3 grupos.' : `no se cumple en ${r.normality.filter((g) => !g.normal).map((g) => g.name).join(', ')}.`}
            </p>
            <p>
              <span className="font-medium">Homogeneidad de varianzas (Levene, mediana):</span>{' '}
              F({r.levene.df1}, {r.levene.df2}) = {formatStat(r.levene.f)}, p {formatP(r.levene.p)}{' '}
              {r.levene.homogeneous ? '✓' : '✗'}
            </p>
            <p>
              <span className="font-medium">Prueba elegida:</span> {TEST_NAMES[r.test.kind]}
              {r.test.kind === 'anova' && ' (normalidad y homogeneidad se cumplen)'}
              {r.test.kind === 'welch' && ' (normalidad se cumple, varianzas distintas)'}
              {r.test.kind === 'kruskal' && ' (normalidad no se cumple)'}
            </p>
          </div>

          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {r.test.kind === 'kruskal'
                ? `H(${r.test.df1}) = ${formatStat(r.test.statistic)}`
                : `F(${r.test.df1}, ${r.test.kind === 'welch' ? formatStat(r.test.df2 ?? NaN) : r.test.df2}) = ${formatStat(r.test.statistic)}`}
              , p {formatP(r.test.p)}, {r.test.effectSize.name} = {formatSmall(r.test.effectSize.value)}
            </span>
            <SignificanceBadge significant={r.test.significant} />
          </p>

          <div>
            <p className="font-medium mb-1">Comparaciones entre pares ({r.postHoc.method})</p>
            {!r.test.significant && (
              <p className="text-xs text-slate-500 mb-1">La prueba global no es significativa: las comparaciones son solo de referencia.</p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="text-slate-600">
                  <tr>
                    <th className="pr-4 py-1 font-semibold">Comparación</th>
                    <th className="pr-4 py-1 font-semibold">{r.test.kind === 'kruskal' ? 'Dif. de rangos' : 'Dif. de medias'}</th>
                    <th className="pr-4 py-1 font-semibold">{r.test.kind === 'kruskal' ? 'z' : 'q'}</th>
                    <th className="pr-4 py-1 font-semibold">p{r.test.kind === 'kruskal' ? ' (Holm)' : ''}</th>
                    <th className="pr-4 py-1 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {r.postHoc.comparisons.map((c) => (
                    <tr key={`${c.a}-${c.b}`} className="border-t">
                      <td className="pr-4 py-1 capitalize">{c.a} – {c.b}</td>
                      <td className="pr-4 py-1">{formatStat(c.difference)}</td>
                      <td className="pr-4 py-1">{formatStat(c.statistic)}</td>
                      <td className="pr-4 py-1">p {formatP(c.p)}</td>
                      <td className="pr-4 py-1">{c.p < alpha ? <span className="text-green-700 font-semibold">*</span> : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CountList({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-slate-500">Sin datos</p>;
  return (
    <ul className="pl-4 space-y-1">
      {entries.map(([label, count]) => (
        <li key={label} className="flex justify-between gap-4 max-w-[280px]">
          <span>{label}</span>
          <span className="font-semibold">{count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastUpdated(new Date());
        setIsAuthenticated(true);
        setDashboardError('');
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      } else {
        const body = await res.json().catch(() => null);
        setIsAuthenticated(true);
        setDashboardError(body?.error || 'Error al cargar las estadísticas del servidor.');
      }
    } catch (err) {
      console.error(err);
      setIsAuthenticated(true);
      setDashboardError('Error de red al intentar conectar con el servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const sortableHeader = (key: string, label: string) => (
    <th className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => requestSort(key)}>
      {label} {sortConfig?.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }) : '-';

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

  const downloadIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Dashboard del Experimento</h1>
            {lastUpdated && (
              <p className="text-sm text-slate-500 mt-1">
                Actualizado a las {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchStats}
              disabled={refreshing}
              className="bg-white hover:bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded shadow border border-slate-300 transition disabled:opacity-50"
            >
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
            <a
              href="/api/admin/export-xlsx"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded shadow transition inline-flex items-center gap-2"
            >
              {downloadIcon}
              Exportar Excel (participantes)
            </a>
            <a
              href="/api/admin/export-csv"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow transition inline-flex items-center gap-2"
            >
              {downloadIcon}
              Exportar CSV (respuestas)
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Total Participantes</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.totalParticipants}</p>
              <p className="text-sm text-slate-500 mt-1">{stats.inProgressParticipants} en curso ahora</p>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Completados</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.completedParticipants} <span className="text-lg text-slate-500 font-normal">({stats.completionRate.toFixed(1)}%)</span></p>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-amber-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Excluidos / Incluidos</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.excludedParticipants} / {stats.includedParticipants}</p>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-sky-500">
              <h3 className="text-slate-500 text-sm font-medium uppercase">Muestra analizada</h3>
              <p className="text-3xl font-bold text-slate-800 mt-2">{stats.analysedParticipants}</p>
              <p className="text-sm text-slate-500 mt-1">
                incluidos y completos · mínimo {stats.targets.minPerGroup * 3}, ideal {stats.targets.idealPerGroup * 3}
              </p>
            </div>
          </div>
        )}

        {stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold text-slate-800 mb-1 flex flex-wrap items-center gap-2">
                  Avance por Grupo
                  {stats.isBalanced ? (
                    <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Balanceado</span>
                  ) : (
                    <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">Desbalanceado (Δ={stats.maxDiscrepancy})</span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Incluidos y completos. Mínimo {stats.targets.minPerGroup} por grupo (línea), ideal {stats.targets.idealPerGroup}.
                </p>
                <div className="space-y-4">
                  {GROUPS.map(grp => {
                    const { analysed, inProgress } = stats.groupProgress[grp];
                    const ideal = stats.targets.idealPerGroup;
                    const reachedMin = analysed >= stats.targets.minPerGroup;
                    return (
                      <div key={grp}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium capitalize">{grp}</span>
                          <span>
                            <span className={reachedMin ? 'font-semibold text-green-700' : 'font-semibold'}>{analysed}</span>
                            <span className="text-slate-500"> / {stats.targets.minPerGroup} (ideal {ideal})</span>
                            {inProgress > 0 && <span className="text-slate-500"> · {inProgress} en curso</span>}
                          </span>
                        </div>
                        <div className="relative w-full bg-slate-200 rounded-full h-2">
                          <div className={`${GROUP_BAR_COLORS[grp]} h-2 rounded-full`} style={{ width: `${Math.min(100, (analysed / ideal) * 100)}%` }}></div>
                          <div className="absolute top-[-3px] h-[14px] w-0.5 bg-slate-700" style={{ left: `${(stats.targets.minPerGroup / ideal) * 100}%` }} title={`Mínimo: ${stats.targets.minPerGroup}`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Razones de Exclusión</h3>
                {Object.keys(stats.exclusionBreakdown).length > 0 ? (
                  <ul className="space-y-2">
                    {Object.entries(stats.exclusionBreakdown).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                      <li key={reason} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{exclusionLabel(reason)}</span>
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
                <h3 className="text-lg font-semibold text-slate-800 mb-4">KPIs Globales (Muestra Analizada)</h3>
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
                    <span className="text-slate-600">Tiempo de rta prom.</span>
                    <span className="font-semibold">{(stats.kpis.overall.avgResponseTimeMs / 1000).toFixed(2)} s</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Demografía (Muestra Analizada)</h3>
                <p className="text-xs text-slate-500 mb-4">n = {stats.analysedParticipants}</p>
                {stats.analysedParticipants > 0 && (
                  <div className="mb-4 text-sm space-y-1">
                    <p><span className="text-slate-600 font-medium">Edad Promedio:</span> {stats.demographics.age.mean.toFixed(1)} (DE: {stats.demographics.age.sd.toFixed(1)})</p>
                    <p><span className="text-slate-600 font-medium">Rango de Edades:</span> {stats.demographics.age.min} - {stats.demographics.age.max}</p>
                  </div>
                )}
                <div className="text-sm space-y-3">
                  <div>
                    <span className="text-slate-600 font-medium block mb-1">Género:</span>
                    <CountList counts={stats.demographics.gender} />
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium block mb-1">Orientación:</span>
                    <CountList counts={stats.demographics.orientation} />
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium block mb-1">Residencia:</span>
                    <CountList counts={stats.demographics.residence} />
                  </div>
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
                      <th className="px-4 py-3 font-semibold">n</th>
                      <th className="px-4 py-3 font-semibold">Falsos Recuerdos</th>
                      <th className="px-4 py-3 font-semibold">Falsas Creencias</th>
                      <th className="px-4 py-3 font-semibold">Memoria Verdadera</th>
                      <th className="px-4 py-3 font-semibold">T. Respuesta (s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {GROUPS.map(grp => {
                      const data = stats.kpis.byGroup[grp];
                      if (!data) return null;
                      return (
                        <tr key={grp}>
                          <td className="px-4 py-3 font-medium capitalize">{grp}</td>
                          <td className="px-4 py-3">{stats.groupProgress[grp].analysed}</td>
                          <td className="px-4 py-3 text-red-600">{data.falseMemoryRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-amber-600">{data.falseBeliefRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-green-600">{data.trueMemoryRate.toFixed(1)}%</td>
                          <td className="px-4 py-3">{(data.avgResponseTimeMs / 1000).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Estadística Inferencial (Muestra Analizada)</h3>
              <p className="text-xs text-slate-500 mb-4">
                Primero los supuestos: normalidad en cada grupo (Shapiro-Wilk) y homogeneidad de varianzas (Levene).
                Si se cumplen ambos, ANOVA de un factor (Tukey-Kramer); si solo la normalidad, ANOVA de Welch
                (Games-Howell); si algún grupo no es normal, Kruskal-Wallis (Dunn con corrección de Holm). α = {stats.inferential.alpha}.
              </p>
              {stats.inferential.preliminary && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-4 py-3 rounded mb-4">
                  <strong>Resultados preliminares.</strong> Algún grupo tiene menos de {stats.targets.minPerGroup} participantes
                  analizados. No decidir cuándo cortar la recolección según estos valores p: el corte es por tamaño de muestra.
                </div>
              )}
              <div className="space-y-4">
                {stats.inferential.analyses.map((analysis) => (
                  <InferentialCard key={analysis.key} analysis={analysis} alpha={stats.inferential.alpha} />
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow mt-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Chequeo de Manipulación (Muestra Analizada)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Inducción Reportada según Grupo Asignado</h4>
                  <div className="overflow-x-auto border rounded bg-slate-50">
                    <table className="min-w-full text-sm text-left">
                      <thead className="text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Grupo</th>
                          <th className="px-3 py-2 font-semibold">Emoción</th>
                          <th className="px-3 py-2 font-semibold">Razón</th>
                          <th className="px-3 py-2 font-semibold">Coincide</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(['racional', 'emocional'] as const).map(grp => {
                          const counts = stats.manipulationCheck.reportedByGroup[grp] || {};
                          const emotion = counts['Emoción'] || 0;
                          const reason = counts['Razón'] || 0;
                          const total = emotion + reason;
                          const matching = grp === 'emocional' ? emotion : reason;
                          return (
                            <tr key={grp}>
                              <td className="px-3 py-2 font-medium capitalize">{grp}</td>
                              <td className="px-3 py-2">{emotion}</td>
                              <td className="px-3 py-2">{reason}</td>
                              <td className="px-3 py-2 font-semibold">{total > 0 ? `${matching}/${total} (${((matching / total) * 100).toFixed(0)}%)` : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">El grupo control no responde esta pregunta.</p>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Uso Reportado por Grupo (1-5)</h4>
                  <div className="space-y-3 text-sm">
                    {GROUPS.map(grp => {
                      const data = stats.manipulationCheck.scoresByGroup[grp];
                      if (!data) return null;
                      return (
                        <div key={grp} className="border-b pb-2 last:border-0">
                          <div className="font-medium mb-1 text-slate-800"><span className="capitalize">{grp}</span> <span className="text-slate-500 font-normal">(n = {data.n})</span></div>
                          <div className="flex justify-between text-slate-600">
                            <span>Uso de Emoción:</span>
                            <span className="font-semibold">{data.n > 0 ? data.avgEmotionUsage.toFixed(2) : '-'}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Uso de Razón:</span>
                            <span className="font-semibold">{data.n > 0 ? data.avgReasonUsage.toFixed(2) : '-'}</span>
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
                      {sortableHeader('id', 'ID')}
                      {sortableHeader('createdAt', 'Inicio')}
                      {sortableHeader('status', 'Estado')}
                      {sortableHeader('isIncluded', 'Inc?')}
                      {sortableHeader('inductionGroup', 'Grupo')}
                      {sortableHeader('age', 'Edad')}
                      {sortableHeader('gender', 'Género')}
                      {sortableHeader('therapeuticOrientation', 'Orientación')}
                      {sortableHeader('residence', 'Residencia')}
                      {sortableHeader('exclusionReason', 'Razón Excl.')}
                      {sortableHeader('completedAt', 'Completado')}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sortedParticipants.map(p => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 font-mono text-xs">{p.id}</td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap">{formatDate(p.createdAt)}</td>
                        <td className="px-4 py-2">{STATUS_LABELS[p.status] || p.status}</td>
                        <td className="px-4 py-2">{p.isIncluded ? 'Sí' : 'No'}</td>
                        <td className="px-4 py-2 capitalize">{p.inductionGroup}</td>
                        <td className="px-4 py-2">{p.age}</td>
                        <td className="px-4 py-2">{p.gender}</td>
                        <td className="px-4 py-2 truncate max-w-[150px]" title={p.therapeuticOrientation}>{p.therapeuticOrientation}</td>
                        <td className="px-4 py-2 truncate max-w-[150px]" title={p.residence || ''}>{p.residence || '-'}</td>
                        <td className="px-4 py-2 text-xs text-red-600">{p.exclusionReason ? exclusionLabel(p.exclusionReason) : '-'}</td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap">{formatDate(p.completedAt)}</td>
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
