import React, { useMemo } from 'react';
import { LogEntry, Tag } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Activity, Code2, Cpu, Calendar, TrendingUp } from 'lucide-react';
import { CalendarHeatmap } from './CalendarHeatmap';

interface DashboardProps {
  logs: LogEntry[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export const Dashboard: React.FC<DashboardProps> = ({ logs }) => {
  const stats = useMemo(() => {
    const totalLogs = logs.length;
    const uniqueTags = new Set(logs.flatMap(l => l.tags.map(t => t.name))).size;
    
    // Tech Stack Distribution
    const tagCounts: Record<string, number> = {};
    logs.forEach(l => {
      l.tags.filter(t => t.category === 'Language' || t.category === 'Framework').forEach(t => {
        tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
      });
    });
    
    const chartData = Object.entries(tagCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Recent Activity (Last 7 days count)
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return d.toLocaleDateString(undefined, { weekday: 'short' });
    });
    
    const activityData = last7Days.map(day => ({
        day,
        count: logs.filter(l => new Date(l.timestamp).toLocaleDateString(undefined, { weekday: 'short' }) === day).length
    }));

    return { totalLogs, uniqueTags, chartData, activityData };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Total Entries</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.totalLogs}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Unique Tags</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.uniqueTags}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Consistency</p>
            <h3 className="text-2xl font-bold text-slate-800">Active</h3>
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          Contribution Activity
        </h3>
        <CalendarHeatmap logs={logs} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tech Stack */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-500" />
            Top Technologies
          </h3>
          <div className="flex-1 w-full">
            {stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No tech stack data yet.</div>
            )}
          </div>
          {stats.chartData.length > 0 && (
             <div className="flex flex-wrap justify-center gap-2 mt-2">
                {stats.chartData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                        {d.name}
                    </div>
                ))}
             </div>
          )}
        </div>

        {/* Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Weekly Activity</h3>
          <div className="flex-1 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.activityData}>
                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                 <YAxis hide />
                 <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 4, 4]} barSize={32} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};