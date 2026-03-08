'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Calendar, Video, Stethoscope, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

export function AppointmentBooking() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    appointment_type: 'Regular Check-up',
    booking_mode: 'In-person',
    doctor_type: 'Primary Care Physician',
    date: '',
    time_slot: '09:00 AM',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const payload = {
        userId: user.userId,
        ...form,
        datetime: new Date(`${form.date}T${form.time_slot.replace(' AM', ':00').replace(' PM', ':00')}`).toISOString(), 
        status: 'Scheduled'
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        throw new Error('Failed to book');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to book the appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">Appointment Confirmed</h3>
        <p className="text-muted-foreground mb-6">Your {form.booking_mode.toLowerCase()} session for {new Date(form.date).toLocaleDateString()} has been scheduled.</p>
        <button 
          onClick={() => setSuccess(false)}
          className="px-6 py-2 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80"
        >
          Book Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Schedule an Appointment</h2>
          <p className="text-muted-foreground text-sm">Book regular specialist visits or request immediate telehealth assistance.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-card border border-border p-6 sm:p-8 rounded-2xl">
        
        {/* Type & Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Urgency Level</label>
            <div className="flex bg-muted rounded-xl p-1">
              <button
                type="button"
                onClick={() => setForm({...form, appointment_type: 'Regular Check-up'})}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                  form.appointment_type === 'Regular Check-up' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Stethoscope className="w-4 h-4" /> Routine
              </button>
              <button
                type="button"
                onClick={() => setForm({...form, appointment_type: 'Urgent / Immediate Concern'})}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                  form.appointment_type === 'Urgent / Immediate Concern' ? 'bg-rose-500 text-white shadow' : 'text-muted-foreground hover:text-rose-500'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Urgent
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Consultation Mode</label>
            <div className="flex bg-muted rounded-xl p-1">
               <button
                type="button"
                onClick={() => setForm({...form, booking_mode: 'In-person'})}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                  form.booking_mode === 'In-person' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                In-person
              </button>
              <button
                type="button"
                onClick={() => setForm({...form, booking_mode: 'Telehealth'})}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                  form.booking_mode === 'Telehealth' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Video className="w-4 h-4" /> Telehealth
              </button>
            </div>
          </div>
        </div>

        {/* Doctor and Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2 text-muted-foreground">Specialist Required</label>
            <select 
              className="w-full bg-background border border-border rounded-lg px-4 py-3"
              value={form.doctor_type}
              onChange={e => setForm({...form, doctor_type: e.target.value})}
            >
              <option>Primary Care Physician</option>
              <option>Cardiologist</option>
              <option>Endocrinologist</option>
              <option>Dietitian</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-muted-foreground">Desired Date</label>
            <input 
              type="date" 
              required
              className="w-full bg-background border border-border rounded-lg px-4 py-3"
              value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-muted-foreground">Notes/Symptoms for the Doctor</label>
          <textarea 
            className="w-full bg-background border border-border rounded-lg px-4 py-3 min-h-[100px] resize-y"
            placeholder="Please describe any symptoms or specific concerns..."
            value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
          />
        </div>

        <div className="pt-4 border-t border-border">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
            Confirm Appointment
          </button>
        </div>
      </form>
    </div>
  );
}
