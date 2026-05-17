import { useCallback, useState } from 'react';

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error';

export type GeoResult = {
  lat: number;
  lng: number;
  accuracy: number;   // meters
  capturedAt: string; // ISO
};

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [coords, setCoords] = useState<GeoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const request = useCallback((): Promise<GeoResult | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable');
        setErrorMsg('Your browser does not support location services.');
        resolve(null);
        return;
      }
      setStatus('requesting');
      setErrorMsg(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result: GeoResult = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            capturedAt: new Date().toISOString(),
          };
          setCoords(result);
          setStatus('granted');
          resolve(result);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setStatus('denied');
            setErrorMsg('Location permission denied. Enable it in your browser settings.');
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setStatus('unavailable');
            setErrorMsg('Location unavailable. Try again outdoors or near a window.');
          } else if (err.code === err.TIMEOUT) {
            setStatus('error');
            setErrorMsg('Location request timed out. Try again.');
          } else {
            setStatus('error');
            setErrorMsg(err.message || 'Could not get location.');
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setCoords(null);
    setErrorMsg(null);
  }, []);

  return { status, coords, errorMsg, request, reset };
}
