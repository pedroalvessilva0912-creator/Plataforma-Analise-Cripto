import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// --- TYPES --- //
interface HistoricalData {
  date: string;
  price: number;
}

interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  marketCap: string;
  volume24h: string;
  color: string;
  history: HistoricalData[];
}

interface RiskReturnAnalysis {
  nivelDeRisco: string;
  potencialDeRetorno: string;
  analise: string;
}


// --- GEMINI SERVICE --- //
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
      nivelDeRisco: {
        type: Type.STRING,
        description: "O nível de risco do investimento, categorizado como 'Baixo', 'Médio' ou 'Alto'.",
      },
      potencialDeRetorno: {
        type: Type.STRING,
        description: "O potencial de retorno do investimento, categorizado como 'Baixo', 'Médio' ou 'Alto'.",
      },
      analise: {
        type: Type.STRING,
        description: "Uma análise detalhada em 3-4 frases sobre os fatores de risco e retorno, justificando as classificações.",
      },
    },
    required: ["nivelDeRisco", "potencialDeRetorno", "analise"],
};

const analyzeCryptoRiskReturn = async (crypto: CryptoData): Promise<RiskReturnAnalysis> => {
  try {
    const prompt = `Como um analista de investimentos experiente, analise o risco e o retorno para a criptomoeda ${crypto.name} (${crypto.symbol}). O preço atual é aproximadamente $${crypto.price.toFixed(2)} e a capitalização de mercado é de ${crypto.marketCap}. Considere a volatilidade histórica (simulada), o volume de negociação e o sentimento geral do mercado de criptoativos. Forneça uma análise concisa, profissional e direta para um investidor, usando o schema JSON fornecido.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const jsonText = response.text.trim();
    const analysisData = JSON.parse(jsonText);
    
    return analysisData;

  } catch (error) {
    console.error("Erro ao buscar análise do Gemini API:", error);
    throw new Error("Não foi possível se comunicar com o serviço de IA.");
  }
};


// --- DATA HOOK --- //
const useCryptoData = () => {
  const [cryptos, setCryptos] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const COIN_COLORS: { [key: string]: string } = {
      bitcoin: '#f7931a',
      ethereum: '#627eea',
      solana: '#9945FF',
      cardano: '#0033ad',
      ripple: '#00aae4',
      dogecoin: '#c2a633',
    };

    const generateMockHistory = (basePrice: number, days = 30): HistoricalData[] => {
      const history: HistoricalData[] = [];
      let price = basePrice;
      const today = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (days - 1 - i));
        const volatility = (Math.random() - 0.45) * 0.1; // Simula a volatilidade diária
        price *= (1 + volatility);
        history.push({
          date: date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
          price: parseFloat(price.toFixed(2)),
        });
      }
      return history;
    };

    const MOCK_DATA: CryptoData[] = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', price: 67500.82, change24h: 1.5, marketCap: '1.3T', volume24h: '25.5B', color: COIN_COLORS.bitcoin, history: generateMockHistory(65000) },
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', price: 3500.45, change24h: -0.8, marketCap: '420B', volume24h: '15.2B', color: COIN_COLORS.ethereum, history: generateMockHistory(3600) },
      { id: 'solana', name: 'Solana', symbol: 'SOL', price: 150.1, change24h: 3.2, marketCap: '69B', volume24h: '3.1B', color: COIN_COLORS.solana, history: generateMockHistory(140) },
      { id: 'cardano', name: 'Cardano', symbol: 'ADA', price: 0.45, change24h: -2.1, marketCap: '16B', volume24h: '500M', color: COIN_COLORS.cardano, history: generateMockHistory(0.48) },
      { id: 'ripple', name: 'Ripple', symbol: 'XRP', price: 0.52, change24h: 0.5, marketCap: '28B', volume24h: '1.2B', color: COIN_COLORS.ripple, history: generateMockHistory(0.51) },
      { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', price: 0.15, change24h: 5.8, marketCap: '21B', volume24h: '900M', color: COIN_COLORS.dogecoin, history: generateMockHistory(0.13) },
    ];

    const loadMockData = () => {
      setLoading(true);
      setError(null);
      setTimeout(() => {
        try {
          setCryptos(MOCK_DATA);
        } catch (err) {
            setError('Falha ao carregar os dados simulados.');
            console.error(err);
        } finally {
          setLoading(false);
        }
      }, 500);
    };

    loadMockData();
  }, []);

  return { cryptos, loading, error };
};


// --- UI COMPONENTS --- //
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
    const sizeClasses = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
    return (
        <svg className={`animate-spin text-cyan-400 ${sizeClasses[size]}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
};

const Header: React.FC = () => (
    <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            <h1 className="text-2xl font-bold text-white ml-2">CriptoInvest Pro</h1>
          </div>
        </div>
      </div>
    </header>
);

const CryptoChart: React.FC<{ data: HistoricalData[], color: string }> = ({ data, color }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-700 p-2 border border-slate-600 rounded-md shadow-lg">
          <p className="label text-white">{`${label}`}</p>
          <p className="intro" style={{ color }}>{`Preço: $${payload[0].value.toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };
    
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const CryptoCard: React.FC<{ crypto: CryptoData, isSelected: boolean, onSelect: () => void }> = ({ crypto, isSelected, onSelect }) => {
  const isPositive = crypto.change24h >= 0;
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500';
  const sparklineColor = isPositive ? '#22c55e' : '#ef4444';
  const selectedClasses = isSelected ? 'ring-2 ring-cyan-400 scale-105 shadow-cyan-500/30' : 'ring-1 ring-slate-700 hover:ring-cyan-500';

  return (
    <div onClick={onSelect} className={`bg-slate-800 p-4 rounded-lg cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col justify-between ${selectedClasses}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-white">{crypto.name}</p>
          <p className="text-sm text-gray-400">{crypto.symbol}</p>
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-700 font-bold text-white">{crypto.symbol}</div>
      </div>
      <div className="h-12 w-full my-2">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={crypto.history}><Line type="monotone" dataKey="price" stroke={sparklineColor} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </div>
      <div className="text-right">
        <p className="text-xl font-semibold text-white">${crypto.price.toLocaleString('en-US')}</p>
        <p className={`text-md font-medium ${changeColor}`}>{isPositive ? '+' : ''}{crypto.change24h.toFixed(2)}%</p>
      </div>
    </div>
  );
};

const Dashboard: React.FC<{ cryptos: CryptoData[], selectedCrypto: CryptoData | null, onCryptoSelect: (crypto: CryptoData) => void }> = ({ cryptos, selectedCrypto, onCryptoSelect }) => (
    <div className="space-y-8">
      {selectedCrypto && (
        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{selectedCrypto.name} ({selectedCrypto.symbol})</h2>
          <p className="text-3xl sm:text-4xl font-semibold text-white">${selectedCrypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="h-80 sm:h-96 w-full mt-4"><CryptoChart data={selectedCrypto.history} color={selectedCrypto.color} /></div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cryptos.map((crypto) => (
          <CryptoCard key={crypto.id} crypto={crypto} isSelected={selectedCrypto?.id === crypto.id} onSelect={() => onCryptoSelect(crypto)} />
        ))}
      </div>
    </div>
);

const RiskReturnAnalyzer: React.FC<{ selectedCrypto: CryptoData | null }> = ({ selectedCrypto }) => {
  const [analysis, setAnalysis] = useState<RiskReturnAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnalysis(null);
    setError(null);
  }, [selectedCrypto]);

  const handleAnalyze = async () => {
    if (!selectedCrypto) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeCryptoRiskReturn(selectedCrypto);
      setAnalysis(result);
    } catch (err) {
      setError('Falha ao gerar análise. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const getRiskColor = (level: string = '') => {
    switch (level.toLowerCase()) {
      case 'alto': return 'text-red-400';
      case 'médio': return 'text-yellow-400';
      case 'baixo': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getReturnColor = (level: string = '') => {
    switch (level.toLowerCase()) {
      case 'alto': return 'text-green-400';
      case 'médio': return 'text-yellow-400';
      case 'baixo': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-slate-800 p-4 sm:p-6 rounded-lg shadow-lg h-full">
      <h2 className="text-2xl font-bold text-white mb-4">Análise com IA</h2>
      {!selectedCrypto ? (
        <div className="text-center text-gray-400 py-10"><p>Selecione uma criptomoeda no painel para analisar.</p></div>
      ) : (
        <>
          <p className="text-gray-400 mb-4">Analisando: <span className="font-bold text-cyan-400">{selectedCrypto.name}</span></p>
          <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 transition-colors duration-300 flex items-center justify-center">
            {loading ? <LoadingSpinner size="sm" /> : 'Analisar Risco e Retorno'}
          </button>
          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
          <div className="mt-6 space-y-4">
            {!analysis && !loading && <div className="text-center text-gray-400 py-10"><p>Clique no botão para gerar uma análise de risco e potencial de retorno para {selectedCrypto.name} usando a IA do Gemini.</p></div>}
            {analysis && (
              <div className="bg-slate-700/50 p-4 rounded-md space-y-4 animate-fade-in">
                <div><h3 className="font-semibold text-gray-300 text-sm">Nível de Risco</h3><p className={`text-lg font-bold ${getRiskColor(analysis.nivelDeRisco)}`}>{analysis.nivelDeRisco || 'N/A'}</p></div>
                <div><h3 className="font-semibold text-gray-300 text-sm">Potencial de Retorno</h3><p className={`text-lg font-bold ${getReturnColor(analysis.potencialDeRetorno)}`}>{analysis.potencialDeRetorno || 'N/A'}</p></div>
                <div><h3 className="font-semibold text-gray-300 text-sm">Análise Resumida</h3><p className="text-gray-300 mt-1 text-sm">{analysis.analise}</p></div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};


// --- MAIN APPLICATION --- //
function App() {
  const { cryptos, loading, error } = useCryptoData();
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);

  useEffect(() => {
    if (cryptos.length > 0 && !selectedCrypto) {
      setSelectedCrypto(cryptos[0]);
    }
  }, [cryptos, selectedCrypto]);

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      <Header />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {loading && (
          <div className="flex justify-center items-center" style={{ height: 'calc(100vh - 100px)' }}>
            <LoadingSpinner size="lg" />
          </div>
        )}
        {error && (
            <div className="text-red-500 text-center mt-10 p-4 bg-slate-800 rounded-lg">
                <p className="font-bold text-lg">Ocorreu um erro</p>
                <p>{error}</p>
            </div>
        )}
        {!loading && !error && cryptos.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Dashboard cryptos={cryptos} selectedCrypto={selectedCrypto} onCryptoSelect={setSelectedCrypto} />
            </div>
            <div className="lg:col-span-1">
              <RiskReturnAnalyzer selectedCrypto={selectedCrypto} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- RENDER APPLICATION --- //
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento root para montar a aplicação");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);