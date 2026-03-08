'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Loader2, TrendingUp, Activity, Moon } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export function ProgressCharts() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        // Fetch last 30 days
        const res = await fetch(`/api/daily-logs?userId=${user?.userId}`);
        if (res.ok) {
          const json = await res.json();
          // We get `logs` array sorted descending (newest first).
          // Recharts prefers ascending order (oldest -> newest left-to-right).
          const sorted = (json.logs || []).reverse();
          
          // Group by week
          const weeks: Record<string, any> = {};
          sorted.forEach((log: any) => {
            const date = new Date(log.log_date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Sunday
            const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            if (!weeks[weekKey]) {
              weeks[weekKey] = { shortDate: `Week of ${weekKey}`, steps: 0, sleep_hours: 0, stress_level: 0, count: 0 };
            }
            weeks[weekKey].steps += log.steps || 0;
            weeks[weekKey].sleep_hours += log.sleep_hours || 0;
            weeks[weekKey].stress_level += log.stress_level || 0;
            weeks[weekKey].count += 1;
          });

          const chartData = Object.values(weeks).map((w: any) => ({
            shortDate: w.shortDate,
            steps: Math.round(w.steps / w.count),
            sleep_hours: Number((w.sleep_hours / w.count).toFixed(1)),
            stress_level: Number((w.stress_level / w.count).toFixed(1))
          }));

          setData(chartData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-12 bg-muted/50 rounded-2xl border border-border">
        <p className="text-muted-foreground">Not enough data to visualize. Start logging your daily metrics!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-500/10 rounded-xl">
          <TrendingUp className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Historical Trends</h2>
          <p className="text-muted-foreground text-sm">Visualize your physiological recovery and habits over time.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Steps & Activity Chart */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-emerald-500" /> 
            Steps & Movement
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                <XAxis dataKey="shortDate" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background, #ffffff)', color: 'var(--foreground, #000000)', borderColor: 'var(--border, #e5e7eb)', borderRadius: '8px' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="steps" name="Steps Taken" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sleep & Stress Chart */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Moon className="w-4 h-4 text-purple-500" /> 
            Sleep vs Stress Level
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                <XAxis dataKey="shortDate" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background, #ffffff)', color: 'var(--foreground, #000000)', borderColor: 'var(--border, #e5e7eb)', borderRadius: '8px' }}
                />
                <Legend iconType="circle" />
                <Line yAxisId="left" type="monotone" dataKey="sleep_hours" name="Sleep (hrs)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="step" dataKey="stress_level" name="Stress (1-10)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
