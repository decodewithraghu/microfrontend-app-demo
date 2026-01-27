import React, { useState, useEffect } from 'react';

// Using World Bank API for population data
// And REST Countries API for additional country info

function PopulationDisplay({ country }) {
  const [populationData, setPopulationData] = useState(null);
  const [countryDetails, setCountryDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (country) {
      fetchPopulationData();
    }
  }, [country]);

  const fetchPopulationData = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch detailed country info from REST Countries API
      const countryResponse = await fetch(
        `https://restcountries.com/v3.1/alpha/${country.code}?fields=name,population,area,capital,region,subregion,languages,currencies,timezones,borders,flags,gini,demonyms`
      );

      if (!countryResponse.ok) {
        throw new Error('Failed to fetch country details');
      }

      const countryData = await countryResponse.json();
      setCountryDetails(countryData);

      // Fetch historical population data from World Bank API
      const worldBankResponse = await fetch(
        `https://api.worldbank.org/v2/country/${country.code}/indicator/SP.POP.TOTL?format=json&per_page=20`
      );

      if (worldBankResponse.ok) {
        const worldBankData = await worldBankResponse.json();
        if (worldBankData[1]) {
          // Filter out null values and sort by year
          const validData = worldBankData[1]
            .filter(item => item.value !== null)
            .sort((a, b) => b.date - a.date);
          setPopulationData(validData);
        }
      }
    } catch (err) {
      console.error('Population fetch error:', err);
      setError(err.message || 'Failed to load population data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  const calculateDensity = () => {
    if (countryDetails?.population && countryDetails?.area) {
      return (countryDetails.population / countryDetails.area).toFixed(2);
    }
    return 'N/A';
  };

  const calculateGrowthRate = () => {
    if (populationData && populationData.length >= 2) {
      const recent = populationData[0].value;
      const previous = populationData[1].value;
      const rate = ((recent - previous) / previous * 100).toFixed(2);
      return rate;
    }
    return 'N/A';
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading population data for {country.name}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <h3>⚠️ Error Loading Data</h3>
        <p>{error}</p>
        <button onClick={fetchPopulationData} className="btn-retry">Try Again</button>
      </div>
    );
  }

  const languages = countryDetails?.languages 
    ? Object.values(countryDetails.languages).join(', ')
    : 'N/A';

  const currencies = countryDetails?.currencies
    ? Object.values(countryDetails.currencies).map(c => `${c.name} (${c.symbol || ''})`).join(', ')
    : 'N/A';

  return (
    <div className="population-content">
      <div className="country-header">
        <img src={country.flag} alt={country.name} className="country-flag-large" />
        <div>
          <h3>{country.name}</h3>
          <p>📍 {country.capital} • {country.region}</p>
        </div>
      </div>

      {/* Main Population Stats */}
      <div className="main-stats">
        <div className="stat-card primary">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-value">{formatNumber(countryDetails?.population || country.population)}</span>
            <span className="stat-label">Total Population</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📐</span>
          <div className="stat-content">
            <span className="stat-value">{countryDetails?.area?.toLocaleString() || 'N/A'}</span>
            <span className="stat-label">Area (km²)</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏘️</span>
          <div className="stat-content">
            <span className="stat-value">{calculateDensity()}</span>
            <span className="stat-label">Pop. Density (per km²)</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-value">{calculateGrowthRate()}%</span>
            <span className="stat-label">Annual Growth Rate</span>
          </div>
        </div>
      </div>

      {/* Country Details */}
      <div className="details-grid">
        <div className="detail-section">
          <h4>🌍 Geographic Info</h4>
          <div className="detail-item">
            <span className="detail-label">Region:</span>
            <span className="detail-value">{countryDetails?.region || country.region}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Subregion:</span>
            <span className="detail-value">{countryDetails?.subregion || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Timezones:</span>
            <span className="detail-value">{countryDetails?.timezones?.slice(0, 2).join(', ') || 'N/A'}</span>
          </div>
        </div>

        <div className="detail-section">
          <h4>🗣️ Culture & Language</h4>
          <div className="detail-item">
            <span className="detail-label">Languages:</span>
            <span className="detail-value">{languages}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Currencies:</span>
            <span className="detail-value">{currencies}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Demonym:</span>
            <span className="detail-value">{countryDetails?.demonyms?.eng?.m || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Historical Population Data */}
      {populationData && populationData.length > 0 && (
        <div className="historical-section">
          <h4>📊 Historical Population Data</h4>
          <div className="chart-container">
            <div className="bar-chart">
              {populationData.slice(0, 10).reverse().map((item, index) => {
                const maxPop = Math.max(...populationData.slice(0, 10).map(d => d.value));
                const percentage = (item.value / maxPop) * 100;
                return (
                  <div key={item.date} className="bar-item">
                    <div className="bar-wrapper">
                      <div 
                        className="bar" 
                        style={{ height: `${percentage}%` }}
                        title={`${item.date}: ${formatNumber(item.value)}`}
                      />
                    </div>
                    <span className="bar-label">{item.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="population-table">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Population</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {populationData.slice(0, 5).map((item, index) => {
                  const prevItem = populationData[index + 1];
                  const change = prevItem 
                    ? ((item.value - prevItem.value) / prevItem.value * 100).toFixed(2)
                    : '-';
                  return (
                    <tr key={item.date}>
                      <td>{item.date}</td>
                      <td>{item.value.toLocaleString()}</td>
                      <td className={change > 0 ? 'positive' : change < 0 ? 'negative' : ''}>
                        {change !== '-' ? `${change > 0 ? '+' : ''}${change}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="data-source">
        <p>Data provided by <a href="https://restcountries.com/" target="_blank" rel="noopener noreferrer">REST Countries</a> & <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer">World Bank</a></p>
        <p className="update-time">Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

export default PopulationDisplay;
