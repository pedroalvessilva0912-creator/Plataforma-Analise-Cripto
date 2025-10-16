
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPES --- //
interface Crypto {
  id: string;
  name: string;
  symbol: string;
  image: string;
}

interface CryptoStats {
  id: string;
  name: string;
  // FIX: Added 'symbol' property to the CryptoStats interface to resolve a type error on line 180. The API response contains this field.
  symbol: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

interface HistoricalData {
  prices: [number, number][];
  total_volumes: [number, number][];
}

// --- API HELPER --- //
const API_BASE_URL = 'https://api.coingecko.com/api/v3';

async function apiFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${endpoint}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// --- UTILITY FUNCTIONS --- //
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 8 : 2,
  }).format(value);

const formatLargeNumber = (value: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
  
// --- CALCULATION HOOKS --- //
const useTechnicalAnalysis = (prices: [number, number][]) => {
  return useMemo(() => {
    if (!prices || prices.length === 0) {
      return { sma20: [], sma50: [], rsi: [], support: null, resistance: null };
    }

    // SMA
    const calculateSMA = (data: number[], period: number) => {
      const sma = [];
      for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        sma.push({ x: prices[i][0], y: sum / period });
      }
      return sma;
    };
    
    const closingPrices = prices.map(p => p[1]);
    const sma20 = calculateSMA(closingPrices, 20);
    const sma50 = calculateSMA(closingPrices, 50);

    // RSI
    const calculateRSI = (data: number[], period = 14) => {
      const rsi: {x: number, y: number}[] = [];
      let gains = 0;
      let losses = 0;

      for (let i = 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) {
          gains += change;
        } else {
          losses -= change;
        }
        
        if (i >= period) {
          const avgGain = gains / period;
          const avgLoss = losses / period;
          const rs = avgGain / (avgLoss || 1); // Avoid division by zero
          const rsiValue = 100 - (100 / (1 + rs));
          rsi.push({ x: prices[i][0], y: rsiValue });

          const prevChange = data[i - period + 1] - data[i - period];
           if (prevChange > 0) {
              gains -= prevChange;
           } else {
              losses += prevChange;
           }
        }
      }
      return rsi;
    };
    const rsi = calculateRSI(closingPrices);
    
    // Support and Resistance
    const recentPrices = closingPrices.slice(-90); // Look at last 90 days
    const support = Math.min(...recentPrices);
    const resistance = Math.max(...recentPrices);

    return { sma20, sma50, rsi, support, resistance };
  }, [prices]);
};

const useRiskReturnAnalysis = (marketData: CryptoStats[], days: number) => {
    return useMemo(() => {
        if (!marketData || marketData.length === 0) return [];
        return marketData.map(coin => {
            const priceChangeKey = `price_change_percentage_${days}d_in_currency` as keyof typeof coin;
            const dailyReturn = (coin as any)[`price_change_percentage_24h_in_currency`] / 100 || 0;
            // Simplified volatility from 24h change - a real app would use historical data std dev
            const volatility = Math.abs(dailyReturn) * Math.sqrt(365); 
            const annualReturn = (1 + dailyReturn)**365 - 1;

            return {
                x: volatility, // Risk
                y: annualReturn, // Return
                name: coin.name,
                image: coin.image
            };
        });
    }, [marketData, days]);
};


// --- UI COMPONENTS --- //
const Loader = () => <div className="loader"><div className="spinner"></div></div>;
const ErrorMessage = ({ message }: { message: string }) => <div className="error-message">Error: {message}</div>;

const Header = ({ onThemeChange, theme }: { onThemeChange: () => void, theme: string }) => (
  <header className="app-header">
    <h1><span role="img" aria-label="chart icon">📈</span> Crypto Analysis Dashboard</h1>
    <button onClick={onThemeChange} className="theme-switcher" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  </header>
);

const Controls = ({ cryptoList, selectedCrypto, onCryptoChange, period, onPeriodChange, onAddToFavorites, isFavorite }: any) => (
  <div className="header-controls">
    <select className="select-input" value={selectedCrypto} onChange={e => onCryptoChange(e.target.value)} aria-label="Select Cryptocurrency">
      {cryptoList.map((crypto: Crypto) => (
        <option key={crypto.id} value={crypto.id}>{crypto.name}</option>
      ))}
    </select>
    <select className="select-input" value={period} onChange={e => onPeriodChange(e.target.value)} aria-label="Select Time Period">
      <option value="1">1D</option>
      <option value="7">7D</option>
      <option value="30">30D</option>
      <option value="90">90D</option>
      <option value="365">1Y</option>
      <option value="max">Max</option>
    </select>
    <button className="button" onClick={onAddToFavorites}>
      {isFavorite ? '★ Unfavorite' : '☆ Add to Favorites'}
    </button>
  </div>
);

const CurrentPrice = ({ stats }: { stats: CryptoStats | null }) => {
    if (!stats) return null;
    const change = stats.price_change_percentage_24h;
    const changeClass = change >= 0 ? 'positive' : 'negative';

    return (
        <div className="card current-price-card">
            <div className="price-info">
                <h2>{stats.name} ({stats.symbol.toUpperCase()})</h2>
                <span className="price">{formatCurrency(stats.current_price)}</span>
                <span className={`price-change ${changeClass}`}>
                    {change >= 0 ? '▲' : '▼'} {change.toFixed(2)}% (24h)
                </span>
            </div>
            <div className="market-stats">
                <div className="stat">
                    <div className="stat-label">Market Cap</div>
                    <div className="stat-value">{formatLargeNumber(stats.market_cap)}</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Volume (24h)</div>
                    <div className="stat-value">{formatLargeNumber(stats.total_volume)}</div>
                </div>
            </div>
        </div>
    );
};

const ChartComponent = ({ data, techAnalysis }: { data: HistoricalData, techAnalysis: any }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || !data) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        const { support, resistance } = techAnalysis;

        chartInstance.current = new (window as any).Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Price',
                        data: data.prices.map(([time, price]) => ({ x: time, y: price })),
                        borderColor: 'rgb(0, 123, 255)',
                        tension: 0.1,
                        pointRadius: 0,
                        yAxisID: 'y',
                    },
                    {
                        label: 'SMA 20',
                        data: techAnalysis.sma20,
                        borderColor: 'rgb(255, 159, 64)',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        yAxisID: 'y',
                    },
                    {
                        label: 'SMA 50',
                        data: techAnalysis.sma50,
                        borderColor: 'rgb(231, 99, 255)',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        yAxisID: 'y',
                    },
                    {
                        label: 'RSI',
                        data: techAnalysis.rsi,
                        borderColor: 'rgb(75, 192, 192, 0.5)',
                        pointRadius: 0,
                        yAxisID: 'y1',
                    },
                    {
                        label: 'Volume',
                        data: data.total_volumes.map(([time, vol]) => ({ x: time, y: vol })),
                        backgroundColor: 'rgba(150, 150, 150, 0.2)',
                        type: 'bar',
                        yAxisID: 'y2',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Price (USD)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0, max: 100,
                        title: { display: true, text: 'RSI' },
                        grid: { drawOnChartArea: false },
                    },
                    y2: {
                        type: 'linear',
                        display: false, // hide volume axis
                    }
                },
                plugins: {
                    tooltip: { mode: 'index', intersect: false },
                    annotation: {
                        annotations: {
                           ...(support && {
                             line1: {
                               type: 'line',
                               yMin: support,
                               yMax: support,
                               borderColor: 'rgb(40, 167, 69, 0.7)',
                               borderWidth: 2,
                               label: { content: `Support: ${formatCurrency(support)}`, enabled: true, position: 'start' }
                            }
                           }),
                           ...(resistance && {
                            line2: {
                               type: 'line',
                               yMin: resistance,
                               yMax: resistance,
                               borderColor: 'rgb(220, 53, 69, 0.7)',
                               borderWidth: 2,
                               label: { content: `Resistance: ${formatCurrency(resistance)}`, enabled: true, position: 'start' }
                            }
                           })
                        }
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data, techAnalysis]);

    return <div className="chart-wrapper"><canvas ref={chartRef}></canvas></div>;
};

const RiskReturnChart = ({ data }: { data: any[] }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || !data) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;
        
        chartInstance.current = new (window as any).Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Crypto Assets',
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.6)',
                    pointRadius: 8,
                    pointHoverRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Risk (Annualized Volatility)' },
                        ticks: { callback: (value) => `${(Number(value) * 100).toFixed(0)}%` }
                    },
                    y: {
                        title: { display: true, text: 'Return (Annualized)' },
                        ticks: { callback: (value) => `${(Number(value) * 100).toFixed(0)}%` }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = context.raw as any;
                                return `${point.name}: Risk ${(point.x * 100).toFixed(2)}%, Return ${(point.y * 100).toFixed(2)}%`;
                            }
                        }
                    }
                }
            }
        });

    }, [data]);
    
    return <div className="chart-wrapper" style={{height: '400px'}}><canvas ref={chartRef}></canvas></div>;
};

const FavoritesList = ({ favorites, onSelect, onRemove }: { favorites: Crypto[], onSelect: (id: string) => void, onRemove: (id: string) => void }) => (
    <div className="card">
        <h3 className="card-title">Favorites</h3>
        {favorites.length > 0 ? (
            <ul className="favorites-list">
                {favorites.map(fav => (
                    <li key={fav.id} className="favorite-item">
                        <div className="favorite-item-info" onClick={() => onSelect(fav.id)}>
                            <img src={fav.image} alt={fav.name} />
                            <span className="favorite-item-name">{fav.name}</span>
                        </div>
                        <button className="remove-favorite-btn" onClick={(e) => { e.stopPropagation(); onRemove(fav.id); }} aria-label={`Remove ${fav.name} from favorites`}>
                            &times;
                        </button>
                    </li>
                ))}
            </ul>
        ) : (
            <p>No favorites added yet.</p>
        )}
    </div>
);


// --- MAIN APP COMPONENT --- //
const App = () => {
  const [theme, setTheme] = useState('dark');
  const [cryptoList, setCryptoList] = useState<Crypto[]>([]);
  const [marketData, setMarketData] = useState<CryptoStats[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState('bitcoin');
  const [period, setPeriod] = useState('365');
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedFavorites = JSON.parse(localStorage.getItem('cryptoFavorites') || '[]');
    setFavorites(savedFavorites);

    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [coins, market] = await Promise.all([
          apiFetch<Crypto[]>('coins/list?include_platform=false'),
          apiFetch<CryptoStats[]>('coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&locale=en')
        ]);
        setCryptoList(coins);
        setMarketData(market);
      } catch (err: any) {
        setError(err.message);
      }
    };
    fetchInitialData();
  }, []);
  
  useEffect(() => {
    if (!selectedCrypto) return;
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<HistoricalData>(`coins/${selectedCrypto}/market_chart?vs_currency=usd&days=${period}`);
        setHistoricalData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchChartData();
  }, [selectedCrypto, period]);

  const handleToggleFavorite = () => {
      const newFavorites = favorites.includes(selectedCrypto)
          ? favorites.filter(id => id !== selectedCrypto)
          : [...favorites, selectedCrypto];
      setFavorites(newFavorites);
      localStorage.setItem('cryptoFavorites', JSON.stringify(newFavorites));
  };
  
  const favoriteDetails = useMemo(() => {
      return favorites.map(id => cryptoList.find(c => c.id === id)).filter(Boolean) as Crypto[];
  }, [favorites, cryptoList]);
  
  const techAnalysis = useTechnicalAnalysis(historicalData?.prices || []);
  const riskReturnData = useRiskReturnAnalysis(marketData, 30);
  const currentStats = marketData.find(c => c.id === selectedCrypto);

  return (
    <div className="app-container">
      <Header onThemeChange={() => setTheme(theme === 'light' ? 'dark' : 'light')} theme={theme} />
      <Controls 
        cryptoList={cryptoList}
        selectedCrypto={selectedCrypto}
        onCryptoChange={setSelectedCrypto}
        period={period}
        onPeriodChange={setPeriod}
        onAddToFavorites={handleToggleFavorite}
        isFavorite={favorites.includes(selectedCrypto)}
      />

      <main className="dashboard-grid" style={{marginTop: '1.5rem'}}>
        <CurrentPrice stats={currentStats || null} />
        <div className="card main-chart-container">
          <div className="card-header"><h3 className="card-title">Price Chart & Indicators</h3></div>
          {loading ? <Loader /> : error ? <ErrorMessage message={error} /> : historicalData && <ChartComponent data={historicalData} techAnalysis={techAnalysis} />}
        </div>
        
        <div className="card">
             <div className="card-header"><h3 className="card-title">Risk-Return Analysis (Top 100)</h3></div>
             {marketData.length > 0 ? <RiskReturnChart data={riskReturnData} /> : <Loader />}
        </div>
        
        <FavoritesList 
            favorites={favoriteDetails} 
            onSelect={setSelectedCrypto} 
            onRemove={(idToRemove) => {
                const newFavorites = favorites.filter(id => id !== idToRemove);
                setFavorites(newFavorites);
                localStorage.setItem('cryptoFavorites', JSON.stringify(newFavorites));
            }}
        />
        
        <div className="card">
            <h3 className="card-title">News & Insights</h3>
            <p>A integração de notícias em tempo real está em desenvolvimento. Volte em breve para atualizações de mercado e análises de sentimento.</p>
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);