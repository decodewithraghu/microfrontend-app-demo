import React, { useState, useEffect } from 'react';

// Using REST Countries API
const COUNTRIES_API = 'https://restcountries.com/v3.1/all?fields=name,cca2,capital,region,population,flags';

function CountryList({ selectedCountry, onSelectCountry, user }) {
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    filterCountries();
  }, [searchTerm, regionFilter, countries]);

  const fetchCountries = async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear any previous error
      const response = await fetch(COUNTRIES_API);
      if (!response.ok) throw new Error('Failed to fetch countries');
      
      const data = await response.json();
      const sortedCountries = data.sort((a, b) => 
        a.name.common.localeCompare(b.name.common)
      );
      setCountries(sortedCountries);
      setFilteredCountries(sortedCountries);
    } catch (err) {
      setError('Failed to load countries. Please try again later.');
      console.error('Error fetching countries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCountries = () => {
    let filtered = countries;

    if (searchTerm) {
      filtered = filtered.filter(country =>
        country.name.common.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (country.capital && country.capital[0]?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (regionFilter) {
      filtered = filtered.filter(country => country.region === regionFilter);
    }

    setFilteredCountries(filtered);
  };

  const handleSelectCountry = (country) => {
    const countryData = {
      name: country.name.common,
      code: country.cca2,
      capital: country.capital?.[0] || 'N/A',
      region: country.region,
      population: country.population,
      flag: country.flags?.svg || country.flags?.png,
    };
    onSelectCountry(countryData);
  };

  const regions = [...new Set(countries.map(c => c.region))].filter(Boolean).sort();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading countries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        {error}
        <button onClick={fetchCountries} className="btn-retry">Retry</button>
      </div>
    );
  }

  return (
    <div className="country-list-container">
      <div className="mfe-header">
        <h2>🌍 Select a Country</h2>
        <p>Welcome, {user?.name}! Choose a country to view weather and population data.</p>
      </div>

      {selectedCountry && (
        <div className="selected-country-banner">
          <img src={selectedCountry.flag} alt={selectedCountry.name} className="selected-flag" />
          <div>
            <strong>Selected:</strong> {selectedCountry.name}
            <span className="selected-details">
              {selectedCountry.capital} • {selectedCountry.region}
            </span>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search countries or capitals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="region-filter">
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="">All Regions</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="country-stats">
        Showing {filteredCountries.length} of {countries.length} countries
      </div>

      <div className="card-grid">
        {filteredCountries.map((country) => (
          <div
            key={country.cca2}
            className={`card country-card ${selectedCountry?.code === country.cca2 ? 'selected' : ''}`}
            onClick={() => handleSelectCountry(country)}
          >
            <div className="country-flag">
              <img src={country.flags?.svg || country.flags?.png} alt={country.name.common} />
            </div>
            <div className="country-info">
              <h3>{country.name.common}</h3>
              <p><strong>Capital:</strong> {country.capital?.[0] || 'N/A'}</p>
              <p><strong>Region:</strong> {country.region}</p>
              <p><strong>Population:</strong> {country.population.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {filteredCountries.length === 0 && (
        <div className="no-results">
          <p>No countries found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}

export default CountryList;
