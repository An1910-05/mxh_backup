import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_CENTER = [16.047079, 108.20623];

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`,
      { headers: { 'Accept-Language': 'vi' } }
    );
    const data = await res.json();
    if (!data || data.error) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const a = data.address || {};
    const parts = [
      a.amenity || a.shop || a.tourism || a.building,
      a.road || a.pedestrian || a.footway,
      a.suburb || a.quarter || a.neighbourhood,
      a.city_district || a.district,
      a.city || a.town || a.village || a.county,
      a.state,
    ].filter(Boolean);
    return parts.slice(0, 4).join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

async function searchPlaces(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&accept-language=vi&countrycodes=vn`,
      { headers: { 'Accept-Language': 'vi' } }
    );
    return await res.json();
  } catch {
    return [];
  }
}

export default function LocationPicker({ onConfirm, onCancel }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const searchTimeout = useRef(null);

  const [label, setLabel] = useState('');
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [pos, setPos] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const updateMarker = useCallback(async (lat, lng) => {
    setPos({ lat, lng });
    setLoadingLabel(true);
    const name = await reverseGeocode(lat, lng);
    setLabel(name);
    setLoadingLabel(false);
  }, []);

  const flyTo = useCallback((lat, lng) => {
    if (!mapInstance.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapInstance.current.flyTo([lat, lng], 16, { duration: 1 });
  }, []);

  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 13);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      updateMarker(lat, lng);
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      updateMarker(lat, lng);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const { latitude: lat, longitude: lng } = coords;
          map.setView([lat, lng], 16);
          marker.setLatLng([lat, lng]);
          updateMarker(lat, lng);
        },
        () => updateMarker(DEFAULT_CENTER[0], DEFAULT_CENTER[1])
      );
    } else {
      updateMarker(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [updateMarker]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        flyTo(lat, lng);
        updateMarker(lat, lng);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setShowResults(true);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(q);
      setSearchResults(results);
      setSearchLoading(false);
    }, 500);
  };

  const handleSelectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    flyTo(lat, lng);
    updateMarker(lat, lng);
    setSearchQuery(item.display_name);
    setShowResults(false);
    setSearchResults([]);
  };

  const handleConfirm = () => {
    if (!pos) return;
    onConfirm({ lat: pos.lat, lng: pos.lng, label });
  };

  return (
    <div className="loc-picker-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="loc-picker-modal">
        <div className="loc-picker-header">
          <h3 className="loc-picker-title">Chọn vị trí</h3>
          <button className="loc-picker-close" onClick={onCancel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z"/>
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="loc-picker-search-wrap">
          <div className="loc-picker-search-row">
            <div className="loc-picker-search-input-wrap">
              <svg className="loc-picker-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                className="loc-picker-search-input"
                type="text"
                placeholder="Tìm kiếm địa điểm..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                autoComplete="off"
              />
              {searchLoading && <span className="loc-picker-search-spinner" />}
              {searchQuery && !searchLoading && (
                <button className="loc-picker-search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>✕</button>
              )}
            </div>
            <button
              className="loc-picker-gps-btn"
              onClick={handleGetCurrentLocation}
              disabled={gpsLoading}
              title="Lấy vị trí hiện tại"
            >
              {gpsLoading ? (
                <span className="loc-picker-search-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
              )}
              <span>Vị trí của tôi</span>
            </button>
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="loc-picker-search-results">
              {searchResults.map((item) => (
                <button
                  key={item.place_id}
                  className="loc-picker-search-result-item"
                  onMouseDown={() => handleSelectResult(item)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#e41e3f" style={{flexShrink:0}}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="loc-picker-hint">Nhấn vào bản đồ hoặc kéo ghim để chọn vị trí</div>

        <div ref={mapRef} className="loc-picker-map" />

        <div className="loc-picker-footer">
          <div className="loc-picker-label">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#e41e3f">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="loc-picker-label-text">
              {loadingLabel ? 'Đang tìm địa chỉ...' : (label || 'Chưa chọn vị trí')}
            </span>
          </div>
          <div className="loc-picker-actions">
            <button className="loc-picker-btn loc-picker-btn--cancel" onClick={onCancel}>Hủy</button>
            <button
              className="loc-picker-btn loc-picker-btn--confirm"
              onClick={handleConfirm}
              disabled={!pos || loadingLabel}
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
