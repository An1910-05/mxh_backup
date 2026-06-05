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

// Vị trí mặc định khi không lấy được geolocation (bị từ chối / hết giờ / không hỗ trợ).
const FALLBACK = { lat: 21.0278, lon: 105.8342, city: 'Hà Nội' };

export default function useWeather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async (lat, lon, fallbackCity = '') => {
      try {
        const [wRes, gRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`),
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
            headers: { 'Accept-Language': 'vi' },
          }).catch(() => null),
        ]);

        const wData = await wRes.json();
        const { temperature_2m, weather_code } = wData.current;

        let city = fallbackCity;
        try {
          const gData = gRes ? await gRes.json() : null;
          const addr = gData?.address || {};
          city = addr.city || addr.town || addr.village || addr.county || addr.state || fallbackCity;
        } catch {
          // reverse-geocode lỗi (vd nominatim chặn) → giữ fallbackCity
        }

        if (!cancelled) {
          setWeather({
            temp: Math.round(temperature_2m),
            icon: WMO_ICON[weather_code] ?? '🌡️',
            city,
          });
        }
      } catch (err) {
        console.error('[weather]', err.message);
        // Nếu lần lấy theo geolocation thất bại, thử lại bằng vị trí mặc định.
        if (!cancelled && (lat !== FALLBACK.lat || lon !== FALLBACK.lon)) {
          fetchWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.city);
        }
      }
    };

    if (!navigator.geolocation) {
      fetchWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.city);
      return () => { cancelled = true; };
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => fetchWeather(latitude, longitude),
      () => fetchWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.city), // bị từ chối / hết giờ → mặc định Hà Nội
      { timeout: 8000 }
    );

    return () => { cancelled = true; };
  }, []);

  return weather;
}
