'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Calendar, FileText, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface TestRecord {
  test_id?: string;
  test_type: string;
  tested_date: string | null;
  next_due: string | null;
  status: 'Overdue' | 'Due Soon' | 'OK' | 'Completed';
  intervalDays: number;
}

export function MetricsTracker() {
  const { user } = useAuth();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Base configuration rules for tests
  const [testConfig, setTestConfig] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [profRes, assessRes, recordsRes] = await Promise.all([
          fetch(`/api/profile?userId=${user?.userId}`),
          fetch(`/api/risk-assessment?userId=${user?.userId}`),
          fetch(`/api/test-records?userId=${user?.userId}`)
        ]);
        
        const profile = profRes.ok ? (await profRes.json()).profile : null;
        const assessment = assessRes.ok ? (await assessRes.json()).assessment : null;
        const fetchedRecords = recordsRes.ok ? (await recordsRes.json()).records : [];

        // Build expected timeline configuration based on PRD logic
        const riskBand = assessment?.cardioResult?.risk_band ?? assessment?.cardioResult?.risk_category ?? 'Low';
        const isHighRisk = riskBand.toLowerCase() === 'high';
        const hasHypertension = profile?.hypertension === 1;
        const hasDiabetes = profile?.diabetes === 1;

        const baseTests = [
          { type: 'Blood Pressure Check', intervalDays: hasHypertension ? 7 : 30 },
          { type: 'BMI Check', intervalDays: 30 },
          { type: 'Cholesterol Panel', intervalDays: isHighRisk ? 90 : 365 }
        ];

        if (hasDiabetes) baseTests.push({ type: 'Blood Glucose Test', intervalDays: 30 });
        if (isHighRisk) baseTests.push({ type: 'Full Cardiac Panel', intervalDays: 180 });

        setTestConfig(baseTests);

        // Merge DB records with the configuration
        // If a test from the config exists in the DB, use it. Otherwise, create a placeholder.
        const mergedRecords = baseTests.map(bt => {
          const existing = fetchedRecords.find((r: any) => r.test_type === bt.type);
          if (existing) {
            return { ...existing, intervalDays: bt.intervalDays };
          }
          
          // Generate an initial "Due Soon" placeholder if never taken
          const seedDate = new Date();
          seedDate.setDate(seedDate.getDate() + 2); // Prompt user soon
          return {
            test_id: null,
            test_type: bt.type,
            tested_date: null,
            next_due: seedDate.toISOString().split('T')[0],
            status: 'Due Soon',
            intervalDays: bt.intervalDays
          };
        });

        // Sort: Overdue -> Due Soon -> OK
        mergedRecords.sort((a, b) => {
          const weight = { 'Overdue': 0, 'Due Soon': 1, 'OK': 2, 'Completed': 3 };
          return weight[a.status as keyof typeof weight] - weight[b.status as keyof typeof weight];
        });

        setRecords(mergedRecords);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const markComplete = async (record: TestRecord) => {
    if (!user) return;
    setActionLoading(record.test_type);
    try {
      await fetch('/api/test-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          recordId: record.test_id,
          type: record.test_type,
          action: 'complete',
          nextDueOffsetDays: record.intervalDays
        })
      });
      
      // Optimistic Update
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + record.intervalDays);
      const nextStr = nextDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      setRecords(prev => prev.map(r => r.test_type === record.test_type ? {
        ...r, status: 'OK' as const, tested_date: today, next_due: nextStr
      } : r).sort((a, b) => {
        const weight = { 'Overdue': 0, 'Due Soon': 1, 'OK': 2, 'Completed': 3 };
        return weight[a.status as keyof typeof weight] - weight[b.status as keyof typeof weight];
      }));
    } catch (e) {
      console.error(e);
      alert('Failed to update record');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  const getStatusUI = (status: string) => {
    switch(status) {
      case 'Overdue': return { color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: AlertTriangle };
      case 'Due Soon': return { color: 'text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 border-yellow-500/20', icon: Clock };
      default: return { color: 'text-green-500 bg-green-500/10 border-green-500/20', icon: CheckCircle };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Recommended Screening Timeline</h2>
          <p className="text-muted-foreground text-sm">Targeted medical tests derived from your risk profile.</p>
        </div>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent">
        {records.map((r, idx) => {
          const { color, icon: Icon } = getStatusUI(r.status);
          const isUpdating = actionLoading === r.test_type;

          return (
            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              {/* Timeline dot */}
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background ${color.split(' ')[1]} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                <Icon className={`w-4 h-4 ${color.split(' ')[0]}`} />
              </div>
              
              {/* Card */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] pb-4 p-5 rounded-xl border border-border bg-card shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold">{r.test_type}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${color}`}>
                    {r.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                     <span className="block text-xs text-muted-foreground mb-1">Last Tested</span>
                     <span className="font-medium">{r.tested_date ? new Date(r.tested_date).toLocaleDateString() : 'No record'}</span>
                  </div>
                  <div>
                     <span className="block text-xs text-muted-foreground mb-1">Next Due</span>
                     <span className="font-medium">{r.next_due ? new Date(r.next_due).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border flex justify-end">
                  <button 
                    onClick={() => markComplete(r)}
                    disabled={isUpdating}
                    className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUpdating ? <Loader2 className="w-3 h-3 animate-spin"/> : <FileText className="w-3 h-3"/>}
                    Mark as Completed
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
