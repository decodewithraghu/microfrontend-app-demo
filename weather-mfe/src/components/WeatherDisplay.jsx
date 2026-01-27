import React, { useState, useEffect } from 'react';

// Using Open-Meteo API (free, no API key required)
// We'll use the capital city coordinates for weather

// Capital city coordinates (sample data - in production, use a geocoding API)
const CAPITAL_COORDS = {
  'AF': { lat: 34.53, lon: 69.17 }, // Kabul
  'AL': { lat: 41.33, lon: 19.82 }, // Tirana
  'DZ': { lat: 36.75, lon: 3.04 }, // Algiers
  'US': { lat: 38.90, lon: -77.04 }, // Washington D.C.
  'GB': { lat: 51.51, lon: -0.13 }, // London
  'FR': { lat: 48.85, lon: 2.35 }, // Paris
  'DE': { lat: 52.52, lon: 13.40 }, // Berlin
  'IT': { lat: 41.90, lon: 12.50 }, // Rome
  'ES': { lat: 40.42, lon: -3.70 }, // Madrid
  'PT': { lat: 38.72, lon: -9.13 }, // Lisbon
  'NL': { lat: 52.37, lon: 4.89 }, // Amsterdam
  'BE': { lat: 50.85, lon: 4.35 }, // Brussels
  'CH': { lat: 46.95, lon: 7.45 }, // Bern
  'AT': { lat: 48.21, lon: 16.37 }, // Vienna
  'PL': { lat: 52.23, lon: 21.01 }, // Warsaw
  'CZ': { lat: 50.08, lon: 14.44 }, // Prague
  'SE': { lat: 59.33, lon: 18.07 }, // Stockholm
  'NO': { lat: 59.91, lon: 10.75 }, // Oslo
  'FI': { lat: 60.17, lon: 24.94 }, // Helsinki
  'DK': { lat: 55.68, lon: 12.57 }, // Copenhagen
  'IE': { lat: 53.33, lon: -6.26 }, // Dublin
  'RU': { lat: 55.76, lon: 37.62 }, // Moscow
  'CN': { lat: 39.90, lon: 116.41 }, // Beijing
  'JP': { lat: 35.68, lon: 139.69 }, // Tokyo
  'KR': { lat: 37.57, lon: 126.98 }, // Seoul
  'IN': { lat: 28.61, lon: 77.21 }, // New Delhi
  'AU': { lat: -35.28, lon: 149.13 }, // Canberra
  'NZ': { lat: -41.29, lon: 174.78 }, // Wellington
  'BR': { lat: -15.79, lon: -47.88 }, // Brasília
  'AR': { lat: -34.61, lon: -58.38 }, // Buenos Aires
  'MX': { lat: 19.43, lon: -99.13 }, // Mexico City
  'CA': { lat: 45.42, lon: -75.70 }, // Ottawa
  'ZA': { lat: -25.75, lon: 28.19 }, // Pretoria
  'EG': { lat: 30.04, lon: 31.24 }, // Cairo
  'NG': { lat: 9.08, lon: 7.40 }, // Abuja
  'KE': { lat: -1.29, lon: 36.82 }, // Nairobi
  'SA': { lat: 24.69, lon: 46.72 }, // Riyadh
  'AE': { lat: 24.47, lon: 54.37 }, // Abu Dhabi
  'IL': { lat: 31.77, lon: 35.22 }, // Jerusalem
  'TR': { lat: 39.93, lon: 32.86 }, // Ankara
  'GR': { lat: 37.98, lon: 23.73 }, // Athens
  'TH': { lat: 13.75, lon: 100.52 }, // Bangkok
  'VN': { lat: 21.03, lon: 105.85 }, // Hanoi
  'SG': { lat: 1.29, lon: 103.85 }, // Singapore
  'MY': { lat: 3.14, lon: 101.69 }, // Kuala Lumpur
  'ID': { lat: -6.21, lon: 106.85 }, // Jakarta
  'PH': { lat: 14.60, lon: 120.98 }, // Manila
};

// Weather code descriptions
const WEATHER_CODES = {
  0: { desc: 'Clear sky', icon: '☀️' },
  1: { desc: 'Mainly clear', icon: '🌤️' },
  2: { desc: 'Partly cloudy', icon: '⛅' },
  3: { desc: 'Overcast', icon: '☁️' },
  45: { desc: 'Foggy', icon: '🌫️' },
  48: { desc: 'Depositing rime fog', icon: '🌫️' },
  51: { desc: 'Light drizzle', icon: '🌧️' },
  53: { desc: 'Moderate drizzle', icon: '🌧️' },
  55: { desc: 'Dense drizzle', icon: '🌧️' },
  61: { desc: 'Slight rain', icon: '🌧️' },
  63: { desc: 'Moderate rain', icon: '🌧️' },
  65: { desc: 'Heavy rain', icon: '🌧️' },
  71: { desc: 'Slight snow', icon: '🌨️' },
  73: { desc: 'Moderate snow', icon: '🌨️' },
  75: { desc: 'Heavy snow', icon: '❄️' },
  80: { desc: 'Slight rain showers', icon: '🌦️' },
  81: { desc: 'Moderate rain showers', icon: '🌦️' },
  82: { desc: 'Violent rain showers', icon: '⛈️' },
  95: { desc: 'Thunderstorm', icon: '⛈️' },
  96: { desc: 'Thunderstorm with hail', icon: '⛈️' },
  99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

function WeatherDisplay({ country }) {
  const [weather, setWeather] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (country) {
      fetchWeather();
    }
  }, [country]);

  const fetchWeather = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Get coordinates for the capital
      let coords = CAPITAL_COORDS[country.code];
      
      // If no predefined coords, use a geocoding service
      if (!coords) {
        // Use Open-Meteo geocoding
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(country.capital)}&count=1`
        );
        const geoData = await geoResponse.json();
        
        if (geoData.results && geoData.results.length > 0) {
          coords = { lat: geoData.results[0].latitude, lon: geoData.results[0].longitude };
        } else {
          throw new Error('Could not find coordinates for the capital city');
        }
      }

      // Fetch weather data from Open-Meteo
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
      );

      if (!weatherResponse.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const weatherData = await weatherResponse.json();
      setWeather(weatherData);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message || 'Failed to load weather data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading weather data for {country.capital}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <h3>⚠️ Error Loading Weather</h3>
        <p>{error}</p>
        <button onClick={fetchWeather} className="btn-retry">Try Again</button>
      </div>
    );
  }

  if (!weather) return null;

  const current = weather.current;
  const daily = weather.daily;
  const weatherInfo = WEATHER_CODES[current.weather_code] || { desc: 'Unknown', icon: '🌡️' };

  return (
    <div className="weather-content">
      <div className="country-header">
        <img src={country.flag} alt={country.name} className="country-flag-large" />
        <div>
          <h3>{country.name}</h3>
          <p>📍 {country.capital} • {country.region}</p>
        </div>
      </div>

      <div className="current-weather">
        <div className="weather-main">
          <span className="weather-icon-large">{weatherInfo.icon}</span>
          <div className="temp-display">
            <span className="current-temp">{Math.round(current.temperature_2m)}°C</span>
            <span className="weather-desc">{weatherInfo.desc}</span>
          </div>
        </div>
        <div className="feels-like">
          Feels like {Math.round(current.apparent_temperature)}°C
        </div>
      </div>

      <div className="weather-details">
        <div className="detail-card">
          <span className="detail-icon">💧</span>
          <span className="detail-label">Humidity</span>
          <span className="detail-value">{current.relative_humidity_2m}%</span>
        </div>
        <div className="detail-card">
          <span className="detail-icon">💨</span>
          <span className="detail-label">Wind Speed</span>
          <span className="detail-value">{Math.round(current.wind_speed_10m)} km/h</span>
        </div>
        <div className="detail-card">
          <span className="detail-icon">🧭</span>
          <span className="detail-label">Wind Direction</span>
          <span className="detail-value">{current.wind_direction_10m}°</span>
        </div>
        <div className="detail-card">
          <span className="detail-icon">📊</span>
          <span className="detail-label">Pressure</span>
          <span className="detail-value">{Math.round(current.pressure_msl)} hPa</span>
        </div>
      </div>

      <div className="forecast-section">
        <h4>7-Day Forecast</h4>
        <div className="forecast-grid">
          {daily.time.slice(0, 7).map((date, index) => {
            const dayWeather = WEATHER_CODES[daily.weather_code[index]] || { icon: '🌡️' };
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <div key={date} className="forecast-day">
                <span className="day-name">{index === 0 ? 'Today' : dayName}</span>
                <span className="forecast-icon">{dayWeather.icon}</span>
                <span className="forecast-temps">
                  <span className="temp-high">{Math.round(daily.temperature_2m_max[index])}°</span>
                  <span className="temp-low">{Math.round(daily.temperature_2m_min[index])}°</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="data-source">
        <p>Data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo API</a></p>
        <p className="update-time">Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

export default WeatherDisplay;
