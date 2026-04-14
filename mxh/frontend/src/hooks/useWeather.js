import { useState, useEffect } from 'react';

const WMO_ICON = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export default function useWeather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const [wRes, gRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`),
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
              headers: { 'Accept-Language': 'vi' },
            }),
          ]);
          const [wData, gData] = await Promise.all([wRes.json(), gRes.json()]);

          const { temperature_2m, weather_code } = wData.current;
          const addr = gData.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';

          setWeather({
            temp: Math.round(temperature_2m),
            icon: WMO_ICON[weather_code] ?? '🌡️',
            city,
          });
        } catch (err) {
          console.error('[weather]', err.message);
        }
      },
      () => { /* geolocation bị từ chối — bỏ qua */ },
      { timeout: 8000 }
    );
  }, []);

  return weather;
}
