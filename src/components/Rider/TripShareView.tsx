import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { RealLiveMap } from '../Map/RealLiveMap';
import { KerbPlateBadge } from '../Common/KerbComponents';

interface TripShareViewProps {
  token: string;
  onClose?: () => void;
}

export const TripShareView: React.FC<TripShareViewProps> = ({ token, onClose }) => {
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const res = await fetch(`/api/trips/share/${token}`);
        const data = await res.json();
        if (data.success && data.trip) {
          setTrip(data.trip);
        } else {
          setError(data.error || 'Trip link expired or not found');
        }
      } catch (e: any) {
        setError('Could not connect to campus tracking');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
    const interval = setInterval(fetchTrip, 3000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#0E7C3A] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-bold text-[#14201A]">Connecting to live campus tracking...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white text-center">
        <div className="w-16 h-16 rounded-full bg-[#FDE8E8] text-[#D93A3A] flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-[#D93A3A]" />
        </div>
        <h2 className="text-xl font-bold text-[#14201A] mb-2">Trip Not Available</h2>
        <p className="text-sm text-[#7A857F] max-w-xs mb-6">
          {error || 'This live tracking link is either invalid or the trip has already concluded.'}
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#0E7C3A] text-white font-bold text-sm rounded-xl"
          >
            Back to App
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Top Banner */}
      <div className="p-3 bg-white border-b border-[#DDE3DF] shadow-sm flex items-center justify-between z-10">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#7A857F]">Live Campus Trip Share</span>
          <p className="text-sm font-bold text-[#14201A]">Shared by {trip.riderFirstName}</p>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            trip.status === 'completed'
              ? 'bg-[#E6F4EC] text-[#1B9E4B]'
              : trip.status === 'in_progress'
              ? 'bg-[#EBF3FF] text-[#2563EB]'
              : 'bg-[#FFF8E6] text-[#E69500]'
          }`}
        >
          {trip.status === 'in_progress' ? '● In Transit' : trip.status.toUpperCase()}
        </span>
      </div>

      {/* Live Map Area */}
      <div className="flex-1 w-full relative z-0">
        <RealLiveMap
          pickup={{ name: trip.pickupName, lat: trip.pickupCoords[0], lng: trip.pickupCoords[1] }}
          destination={{ name: trip.dropoffName, lat: trip.dropoffCoords[0], lng: trip.dropoffCoords[1] }}
          stage="dispatch"
          selectedRide={trip.vehicleCategory}
        />
      </div>

      {/* Bottom Summary Bar */}
      <div className="p-4 bg-white border-t border-[#DDE3DF] shadow-lg z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-[#7A857F]">Heading to</p>
            <p className="text-sm font-bold text-[#14201A]">{trip.dropoffName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#7A857F]">Fixed Fare</p>
            <p className="text-base font-extrabold text-[#0E7C3A]">₦{trip.fareNaira}</p>
          </div>
        </div>

        {trip.driverFirstName && (
          <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DF]/60 text-xs">
            <span className="text-[#3E4A43]">
              Driver: <strong>{trip.driverFirstName}</strong> ({trip.vehicleModel || 'Campus Vehicle'})
            </span>
            {trip.vehiclePlate && <KerbPlateBadge plate={trip.vehiclePlate} />}
          </div>
        )}

        {trip.status === 'completed' && (
          <div className="mt-3 p-2 bg-[#E6F4EC] text-[#1B9E4B] text-xs font-bold rounded-xl text-center">
            ✓ Trip concluded safely on campus
          </div>
        )}
      </div>
    </div>
  );
};
