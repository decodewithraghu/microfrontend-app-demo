/**
 * Unit Tests for PopulationDisplay Component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PopulationDisplay from '../../src/components/PopulationDisplay';

// Mock country details from REST Countries API
const mockCountryDetails = {
  name: { common: 'United States' },
  population: 331000000,
  area: 9833520,
  capital: ['Washington, D.C.'],
  region: 'Americas',
  subregion: 'Northern America',
  languages: { eng: 'English' },
  currencies: { USD: { name: 'United States dollar', symbol: '$' } },
  timezones: ['UTC-12:00', 'UTC-11:00', 'UTC-10:00'],
  borders: ['CAN', 'MEX'],
  flags: { svg: 'https://flagcdn.com/us.svg' },
  gini: { '2018': 41.4 },
  demonyms: { eng: { m: 'American', f: 'American' } },
};

// Mock World Bank population data
const mockWorldBankData = [
  { page: 1, total: 20 },
  [
    { date: '2024', value: 335000000 },
    { date: '2023', value: 333000000 },
    { date: '2022', value: 331000000 },
    { date: '2021', value: 329500000 },
    { date: '2020', value: 329000000 },
  ],
];

const mockCountry = {
  name: 'United States',
  code: 'US',
  capital: 'Washington, D.C.',
  region: 'Americas',
  population: 331000000,
  flag: 'https://flagcdn.com/us.svg',
};

describe('PopulationDisplay Component', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  describe('Loading State', () => {
    it('should show loading state when fetching data', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));
      
      render(<PopulationDisplay country={mockCountry} />);

      expect(screen.getByText(/loading population data/i)).toBeInTheDocument();
    });

    it('should show country name in loading message', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));
      
      render(<PopulationDisplay country={mockCountry} />);

      expect(screen.getByText(/united states/i)).toBeInTheDocument();
    });
  });

  describe('Successful Data Fetch', () => {
    beforeEach(() => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCountryDetails,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });
    });

    it('should display country header with flag', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByAltText('United States')).toHaveAttribute('src', mockCountry.flag);
      });
    });

    it('should display total population', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/total population/i)).toBeInTheDocument();
        expect(screen.getByText(/331\.00M/)).toBeInTheDocument();
      });
    });

    it('should display area in km²', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/area/i)).toBeInTheDocument();
        expect(screen.getByText(/9,833,520/)).toBeInTheDocument();
      });
    });

    it('should display population density', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/pop\. density/i)).toBeInTheDocument();
      });
    });

    it('should display languages', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/languages/i)).toBeInTheDocument();
        expect(screen.getByText('English')).toBeInTheDocument();
      });
    });

    it('should display currencies', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/currencies/i)).toBeInTheDocument();
        expect(screen.getByText(/united states dollar/i)).toBeInTheDocument();
      });
    });

    it('should display region and subregion', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('Americas')).toBeInTheDocument();
        expect(screen.getByText('Northern America')).toBeInTheDocument();
      });
    });

    it('should display demonym', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/demonym/i)).toBeInTheDocument();
        expect(screen.getByText('American')).toBeInTheDocument();
      });
    });

    it('should display data source attribution', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/rest countries/i)).toBeInTheDocument();
        expect(screen.getByText(/world bank/i)).toBeInTheDocument();
      });
    });
  });

  describe('Historical Population Data', () => {
    beforeEach(() => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCountryDetails,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });
    });

    it('should display historical population section', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/historical population data/i)).toBeInTheDocument();
      });
    });

    it('should display population table with years', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        // Use getAllByText since years appear in both bar chart and table
        expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
      });
    });

    it('should calculate and display growth rate', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        // Should have positive growth indicators
        const positiveChanges = screen.getAllByText(/\+\d+\.\d+%/);
        expect(positiveChanges.length).toBeGreaterThan(0);
      });
    });

    it('should display population bar chart', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        const bars = document.querySelectorAll('.bar');
        expect(bars.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Number Formatting', () => {
    beforeEach(() => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCountryDetails,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });
    });

    it('should format large numbers with M suffix for millions', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/331\.00M/)).toBeInTheDocument();
      });
    });

    it('should format area with comma separators', async () => {
      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/9,833,520/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when country details fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading data/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      render(<PopulationDisplay country={mockCountry} />);

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
          json: async () => mockCountryDetails,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });

      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => {
        expect(screen.getByText(/total population/i)).toBeInTheDocument();
      });
    });

    it('should handle missing World Bank data gracefully', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCountryDetails,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ page: 1 }, null], // No data
        });

      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText(/total population/i)).toBeInTheDocument();
      });

      // Should still display country info even without World Bank data
    });
  });

  describe('Edge Cases', () => {
    it('should handle country without languages', async () => {
      const countryWithoutLanguages = { ...mockCountryDetails, languages: undefined };
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => countryWithoutLanguages,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });

      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });

    it('should handle country without currencies', async () => {
      const countryWithoutCurrencies = { ...mockCountryDetails, currencies: undefined };
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => countryWithoutCurrencies,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });

      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle country without subregion', async () => {
      const countryWithoutSubregion = { ...mockCountryDetails, subregion: undefined };
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => countryWithoutSubregion,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });

      render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should re-fetch data when country changes', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCountryDetails,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });

      const { rerender } = render(<PopulationDisplay country={mockCountry} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const newCountry = {
        name: 'United Kingdom',
        code: 'GB',
        capital: 'London',
        region: 'Europe',
        flag: 'https://flagcdn.com/gb.svg',
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockCountryDetails, name: { common: 'United Kingdom' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorldBankData,
        });

      rerender(<PopulationDisplay country={newCountry} />);

      await waitFor(() => {
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      });
    });
  });
});
