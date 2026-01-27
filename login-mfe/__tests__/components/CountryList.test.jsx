/**
 * Unit Tests for CountryList Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CountryList from '../../src/components/CountryList';

// Mock country data
const mockCountries = [
  {
    name: { common: 'United States' },
    cca2: 'US',
    capital: ['Washington, D.C.'],
    region: 'Americas',
    population: 331000000,
    flags: { svg: 'https://flagcdn.com/us.svg', png: 'https://flagcdn.com/w320/us.png' },
  },
  {
    name: { common: 'United Kingdom' },
    cca2: 'GB',
    capital: ['London'],
    region: 'Europe',
    population: 67000000,
    flags: { svg: 'https://flagcdn.com/gb.svg', png: 'https://flagcdn.com/w320/gb.png' },
  },
  {
    name: { common: 'Japan' },
    cca2: 'JP',
    capital: ['Tokyo'],
    region: 'Asia',
    population: 126000000,
    flags: { svg: 'https://flagcdn.com/jp.svg', png: 'https://flagcdn.com/w320/jp.png' },
  },
  {
    name: { common: 'Australia' },
    cca2: 'AU',
    capital: ['Canberra'],
    region: 'Oceania',
    population: 25000000,
    flags: { svg: 'https://flagcdn.com/au.svg', png: 'https://flagcdn.com/w320/au.png' },
  },
];

const mockUser = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
};

describe('CountryList Component', () => {
  const mockOnSelectCountry = jest.fn();

  beforeEach(() => {
    mockOnSelectCountry.mockClear();
    global.fetch.mockClear();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      expect(screen.getByText(/loading countries/i)).toBeInTheDocument();
    });
  });

  describe('Successful Data Fetch', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockCountries,
      });
    });

    it('should display countries after loading', async () => {
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();
        expect(screen.getByText('Japan')).toBeInTheDocument();
      });
    });

    it('should display user welcome message', async () => {
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument();
      });
    });

    it('should display country count', async () => {
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/showing 4 of 4 countries/i)).toBeInTheDocument();
      });
    });

    it('should show country details including capital and region', async () => {
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/washington, d\.c\./i)).toBeInTheDocument();
        // Use getAllByText since region names appear in both filter dropdown and country cards
        expect(screen.getAllByText(/americas/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Country Selection', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockCountries,
      });
    });

    it('should call onSelectCountry when clicking a country', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const usCard = screen.getByText('United States').closest('.card');
      await user.click(usCard);

      expect(mockOnSelectCountry).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'United States',
          code: 'US',
          capital: 'Washington, D.C.',
          region: 'Americas',
        })
      );
    });

    it('should display selected country banner', async () => {
      const selectedCountry = {
        name: 'United States',
        code: 'US',
        capital: 'Washington, D.C.',
        region: 'Americas',
        flag: 'https://flagcdn.com/us.svg',
      };

      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={selectedCountry} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/selected:/i)).toBeInTheDocument();
      });
    });

    it('should highlight selected country card', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockCountries,
      });

      const selectedCountry = {
        name: 'United States',
        code: 'US',
        capital: 'Washington, D.C.',
        region: 'Americas',
        flag: 'https://flagcdn.com/us.svg',
      };

      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={selectedCountry} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        // Use getAllByText since 'United States' appears in both banner and card
        const usElements = screen.getAllByText('United States');
        const usCard = usElements.find(el => el.closest('.card'))?.closest('.card');
        expect(usCard).toHaveClass('selected');
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockCountries,
      });
    });

    it('should filter countries by name', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search countries/i);
      await user.type(searchInput, 'Japan');

      expect(screen.getByText('Japan')).toBeInTheDocument();
      expect(screen.queryByText('United States')).not.toBeInTheDocument();
    });

    it('should filter countries by capital', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search countries/i);
      await user.type(searchInput, 'Tokyo');

      expect(screen.getByText('Japan')).toBeInTheDocument();
      expect(screen.queryByText('United States')).not.toBeInTheDocument();
    });

    it('should show no results message when no matches', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search countries/i);
      await user.type(searchInput, 'XYZ123');

      expect(screen.getByText(/no countries found/i)).toBeInTheDocument();
    });

    it('should be case insensitive', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Japan')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search countries/i);
      await user.type(searchInput, 'JAPAN');

      expect(screen.getByText('Japan')).toBeInTheDocument();
    });
  });

  describe('Region Filter', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockCountries,
      });
    });

    it('should filter countries by region', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const regionSelect = screen.getByRole('combobox');
      await user.selectOptions(regionSelect, 'Europe');

      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      expect(screen.queryByText('United States')).not.toBeInTheDocument();
      expect(screen.queryByText('Japan')).not.toBeInTheDocument();
    });

    it('should show all countries when "All Regions" selected', async () => {
      const user = userEvent.setup();
      
      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      const regionSelect = screen.getByRole('combobox');
      await user.selectOptions(regionSelect, 'Europe');
      await user.selectOptions(regionSelect, '');

      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when fetch fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load countries/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry fetch when clicking retry button', async () => {
      const user = userEvent.setup();
      
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries });

      render(
        <CountryList 
          user={mockUser} 
          selectedCountry={null} 
          onSelectCountry={mockOnSelectCountry} 
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
