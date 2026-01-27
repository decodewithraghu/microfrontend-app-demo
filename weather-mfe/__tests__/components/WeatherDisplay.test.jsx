/**
 * Unit Tests for WeatherDisplay Component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherDisplay from '../../src/components/WeatherDisplay';

// Mock weather data from Open-Meteo API
const mockWeatherData = {
  current: {
    temperature_2m: 22.5,
    relative_humidity_2m: 65,
    apparent_temperature: 21.8,
    weather_code: 1,
    wind_speed_10m: 12,
    wind_direction_10m: 180,
    pressure_msl: 1015,
  },
  daily: {
    time: [
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
    ],
    temperature_2m_max: [25, 26, 24, 23, 22, 25, 27],
    temperature_2m_min: [18, 19, 17, 16, 15, 18, 20],
    weather_code: [1, 2, 3, 61, 1, 0, 2],
  },
};

const mockCountry = {
  name: 'United States',
  code: 'US',
  capital: 'Washington, D.C.',
  region: 'Americas',
  flag: 'https://flagcdn.com/us.svg',
};

describe('WeatherDisplay Component', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  describe('Loading State', () => {
    it('should show loading state when fetching data', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));
      
      render(<WeatherDisplay country={mockCountry} />);

      expect(screen.getByText(/loading weather data/i)).toBeInTheDocument();
    });

    it('should show country name in loading message', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));
      
      render(<WeatherDisplay country={mockCountry} />);

      expect(screen.getByText(/washington, d\.c\./i)).toBeInTheDocument();
    });
  });

  describe('Successful Data Fetch', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockWeatherData,
      });
    });

    it('should display country header with flag', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByAltText('United States')).toBeInTheDocument();
      });
    });

    it('should display current temperature', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/23°C/)).toBeInTheDocument(); // Rounded from 22.5
      });
    });

    it('should display feels like temperature', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/feels like 22°c/i)).toBeInTheDocument();
      });
    });

    it('should display humidity', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('65%')).toBeInTheDocument();
      });
    });

    it('should display wind speed', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/12 km\/h/i)).toBeInTheDocument();
      });
    });

    it('should display pressure', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/1015 hPa/i)).toBeInTheDocument();
      });
    });

    it('should display weather description', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/mainly clear/i)).toBeInTheDocument();
      });
    });

    it('should display 7-day forecast', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('7-Day Forecast')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
      });
    });

    it('should display data source attribution', async () => {
      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/open-meteo/i)).toBeInTheDocument();
      });
    });
  });

  describe('Weather Code Mapping', () => {
    it('should show correct icon for clear sky (code 0)', async () => {
      const clearWeather = {
        ...mockWeatherData,
        current: { ...mockWeatherData.current, weather_code: 0 },
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => clearWeather,
      });

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        // Use getAllByText since icon appears in both current weather and forecast
        expect(screen.getAllByText('☀️').length).toBeGreaterThan(0);
        expect(screen.getByText(/clear sky/i)).toBeInTheDocument();
      });
    });

    it('should show correct icon for rain (code 61)', async () => {
      const rainyWeather = {
        ...mockWeatherData,
        current: { ...mockWeatherData.current, weather_code: 61 },
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => rainyWeather,
      });

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        // Use getAllByText since icon appears in both current weather and forecast
        expect(screen.getAllByText('🌧️').length).toBeGreaterThan(0);
        expect(screen.getByText(/slight rain/i)).toBeInTheDocument();
      });
    });

    it('should show correct icon for snow (code 71)', async () => {
      const snowyWeather = {
        ...mockWeatherData,
        current: { ...mockWeatherData.current, weather_code: 71 },
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => snowyWeather,
      });

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('🌨️')).toBeInTheDocument();
        expect(screen.getByText(/slight snow/i)).toBeInTheDocument();
      });
    });

    it('should show correct icon for thunderstorm (code 95)', async () => {
      const stormWeather = {
        ...mockWeatherData,
        current: { ...mockWeatherData.current, weather_code: 95 },
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => stormWeather,
      });

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('⛈️')).toBeInTheDocument();
        expect(screen.getByText(/thunderstorm/i)).toBeInTheDocument();
      });
    });
  });

  describe('Country Without Predefined Coordinates', () => {
    it('should use geocoding API for unknown countries', async () => {
      const unknownCountry = {
        name: 'Unknown Country',
        code: 'XX',
        capital: 'Mystery City',
        region: 'Unknown',
        flag: 'https://example.com/flag.svg',
      };

      const mockGeoResponse = {
        results: [{ latitude: 40.0, longitude: -75.0 }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockGeoResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWeatherData,
        });

      render(<WeatherDisplay country={unknownCountry} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('geocoding-api.open-meteo.com')
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when weather fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading weather/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should retry fetch when clicking retry button', async () => {
      const user = userEvent.setup();
      
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWeatherData,
        });

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => {
        expect(screen.getByText(/23°C/)).toBeInTheDocument();
      });
    });

    it('should show error when API returns non-OK response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch weather data/i)).toBeInTheDocument();
      });
    });

    it('should show error when geocoding fails for unknown country', async () => {
      const unknownCountry = {
        name: 'Unknown',
        code: 'XX',
        capital: 'Nowhere',
        region: 'Unknown',
        flag: 'https://example.com/flag.svg',
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      render(<WeatherDisplay country={unknownCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/could not find coordinates/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should re-fetch weather when country changes', async () => {
      // Set up mocks for both initial and rerender fetches before rendering
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWeatherData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWeatherData,
        });

      const { rerender } = render(<WeatherDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const newCountry = {
        name: 'United Kingdom',
        code: 'GB',
        capital: 'London',
        region: 'Europe',
        flag: 'https://flagcdn.com/gb.svg',
      };

      rerender(<WeatherDisplay country={newCountry} />);

      await waitFor(() => {
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      });
    });
  });
});
