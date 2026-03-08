'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { FloatingChat } from '@/components/FloatingChat';
import {
  Search, Star, MapPin, Clock, Sun, Cloud,
  CheckCircle2, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Appointment } from '@/lib/appointmentsService';
import dynamic from 'next/dynamic';

const HospitalMap = dynamic(() => import('@/components/HospitalMap'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full min-h-[400px] bg-muted animate-pulse rounded-2xl flex items-center justify-center text-muted-foreground">Loading Map...</div> 
});

export interface LocationData {
  id: number;
  name: string;
  distance: string;
  rating: number;
  image: string;
  lat?: number;
  lon?: number;
  tags?: any;
}



const fallbackLocations: LocationData[] = [
  {
    id: 1,
    name: 'Downtown Medical Center',
    distance: '0.5 km',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1631217b831ec4bd7f4fa0649ea033019?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 2,
    name: 'Westside Health Clinic',
    distance: '2.3 km',
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1576091160550-2173fe9e0f0d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 3,
    name: 'Central Health Services',
    distance: '1.8 km',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1516534775068-bb6baaf00da8?auto=format&fit=crop&w=300&q=80',
  },
];

const timeSlots = {
  morning: ['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
  afternoon: ['12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'],
};

export default function AppointmentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<LocationData[]>(fallbackLocations);
  const [selectedLocation, setSelectedLocation] = useState<LocationData>(fallbackLocations[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 2)); // March 2025
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);

  // Map & Geolocation State
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    async function loadAppointments() {
      try {
        const res = await fetch(`/api/appointments?userId=${user!.userId}`);
        if (res.ok) {
          const data = await res.json();
          setPastAppointments(data.appointments ?? []);
        }
      } catch {
        // Non-blocking — just won't show past appointments
      } finally {
        setLoadingPast(false);
      }
    }
    loadAppointments();
  }, [user]);

  // Fetch Hospitals via Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        
        try {
          const query = `
            [out:json];
            (
              node["amenity"="hospital"](around:5000, ${latitude}, ${longitude});
              node["amenity"="clinic"](around:5000, ${latitude}, ${longitude});
            );
            out body;
          `;
          const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error('Network response was not ok');
          const data = await res.json();
          const fetchedHospitals = data.elements.filter((el: any) => el.tags && el.tags.name).map((el: any) => ({
            id: el.id,
            lat: el.lat,
            lon: el.lon,
            tags: el.tags,
            name: el.tags?.name || 'Unnamed Healthcare Facility',
            distance: 'Nearby', 
            rating: (4.0 + Math.random()).toFixed(1), // Mock rating
            image: 'https://images.unsplash.com/photo-1516534775068-bb6baaf00da8?auto=format&fit=crop&w=300&q=80',
          }));

          if (fetchedHospitals.length > 0) {
            const topHospitals = fetchedHospitals.slice(0, 10);
            setLocations(topHospitals);
            setSelectedLocation(topHospitals[0]);
          } else {
            setLocationError("No hospitals found nearby.");
          }
        } catch (err) {
          console.error('[Map Fetch Error]', err);
          setLocationError("Failed to fetch nearby hospitals.");
        } finally {
          setLoadingLocation(false);
        }
      },
      (err) => {
        console.error('[Geolocation Error]', err);
        setLocationError("Unable to retrieve your location. Using fallback locations.");
        setLoadingLocation(false);
      },
      { timeout: 10000 }
    );
  }, []);

  const getDaysInMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const handlePrevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const handleNextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const handleDateSelect = (day: number) => {
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    setSelectedSlot(null);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    setIsSubmitting(true);
    try {
      const appointmentDate = selectedDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user!.userId,
          locationName: selectedLocation.name,
          appointmentDate,
          timeSlot: selectedSlot,
          provider: 'Dr. Sarah Chen, MD',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Booking failed');
      }
      const data = await res.json();
      setBookedAppointment(data.appointment);
      setConfirmed(true);
      toast.success('Appointment booked successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Could not book the appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Confirmation screen ─────────────────────────────────────────────────
  if (confirmed && selectedDate && selectedSlot) {
    return (
      <main className="bg-background min-h-screen">
        <Navbar />
        <FloatingChat />

        <div className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 flex items-center justify-center">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle2 className="w-20 h-20 text-primary mx-auto mb-6" />
            <h1 className="text-4xl font-bold mb-4">Appointment Confirmed!</h1>
            <div className="bg-card border border-border rounded-2xl p-8 mb-8">
              <div className="space-y-4 text-left">
                <div>
                  <p className="text-muted-foreground text-sm">Location</p>
                  <p className="font-bold text-lg">{selectedLocation.name}</p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-muted-foreground text-sm">Date &amp; Time</p>
                  <p className="font-bold text-lg">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })}{' '}
                    at {selectedSlot}
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-muted-foreground text-sm">Provider</p>
                  <p className="font-bold text-lg">Dr. Sarah Chen, MD</p>
                </div>
                {bookedAppointment && (
                  <div className="border-t border-border pt-4">
                    <p className="text-muted-foreground text-sm">Confirmation ID</p>
                    <p className="font-mono text-xs text-muted-foreground">{bookedAppointment.appointmentId}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mb-6">
              A confirmation email has been sent to your inbox. You&apos;ll receive a reminder 24 hours before.
            </p>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Booking screen ──────────────────────────────────────────────────────
  return (
    <main className="bg-background min-h-screen">
      <Navbar />
      <FloatingChat />

      <div className="px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Book an Appointment</h1>
            <p className="text-muted-foreground">Find a healthcare provider and schedule your visit</p>
          </div>

          {/* Past Appointments Strip */}
          {!loadingPast && pastAppointments.length > 0 && (
            <div className="mb-10">
              <h2 className="text-lg font-bold mb-4">Your Appointments</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastAppointments.slice(0, 3).map((appt) => (
                  <div key={appt.appointmentId} className="bg-card border border-border rounded-2xl p-4">
                    <p className="font-semibold text-sm">{appt.locationName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{appt.appointmentDate} at {appt.timeSlot}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      appt.appointmentStatus === 'Scheduled' ? 'bg-primary/10 text-primary' :
                      appt.appointmentStatus === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {appt.appointmentStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Display */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
            <div className="lg:col-span-4 h-[400px] border border-border rounded-2xl overflow-hidden shadow-sm relative z-0">
               {userLocation ? (
                 <HospitalMap userLocation={userLocation} hospitals={locations as any} onSelectHospital={(hospital: any) => setSelectedLocation(hospital)} />
               ) : (
                 <div className="w-full h-full bg-muted flex flex-col items-center justify-center text-muted-foreground gap-3">
                   {loadingLocation ? (
                     <><Loader2 className="w-8 h-8 animate-spin" /><span>Getting your location & finding nearby hospitals...</span></>
                   ) : locationError ? (
                     <><MapPin className="w-8 h-8" /><span>{locationError}</span></>
                   ) : (
                     <><MapPin className="w-8 h-8" /><span>Requesting location...</span></>
                   )}
                 </div>
               )}
            </div>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left: Location Selector */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-bold mb-4">Select Location</h2>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search locations..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc)}
                    className={`w-full rounded-2xl overflow-hidden border-2 transition-all text-left ${
                      selectedLocation.id === loc.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <img src={loc.image} alt={loc.name} className="w-full h-32 object-cover" />
                    <div className="p-3">
                      <p className="font-semibold text-sm">{loc.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {loc.distance}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 fill-primary text-primary" />
                          {loc.rating}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Middle: Calendar */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-bold mb-4">Select Date</h2>
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={handlePrevMonth} className="p-1 hover:bg-muted rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="font-semibold text-sm">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button onClick={handleNextMonth} className="p-1 hover:bg-muted rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <p key={day} className="text-center text-xs font-semibold text-muted-foreground h-6 flex items-center justify-center">
                      {day}
                    </p>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {emptyDays.map((_, idx) => <div key={`empty-${idx}`} className="h-8" />)}
                  {days.map((day) => (
                    <button
                      key={day}
                      onClick={() => handleDateSelect(day)}
                      className={`h-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                        selectedDate?.getDate() === day && selectedDate.getMonth() === currentMonth.getMonth()
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Time Slots */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-bold mb-4">
                {selectedDate
                  ? `Select Time — ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'Select a date first'}
              </h2>

              {selectedDate ? (
                <div className="space-y-6">
                  {/* Morning */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                      <Sun className="w-4 h-4 text-amber-500" />
                      Morning
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlots.morning.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                            selectedSlot === slot
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Afternoon */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                      <Cloud className="w-4 h-4 text-orange-500" />
                      Afternoon
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlots.afternoon.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                            selectedSlot === slot
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Booking Summary */}
                  {selectedSlot && (
                    <div className="bg-card border-2 border-primary rounded-2xl p-4">
                      <h3 className="font-bold mb-3">Booking Summary</h3>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{selectedLocation.name}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">
                            {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="text-muted-foreground">Time:</span>
                          <span className="font-medium">{selectedSlot}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</>
                        ) : (
                          'Confirm Appointment'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted rounded-2xl p-8 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">Select a date to view available time slots</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
