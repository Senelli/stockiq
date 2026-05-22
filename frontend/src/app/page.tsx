'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

export default function Home() {
  const [ticker, setTicker]   = useState('')
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const API_KEY = process.env.NEXT_PUBLIC_AV_KEY_1

  async function searchStock() {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    setData(null)

    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker.toUpperCase()}&apikey=${API_KEY}`
      )
      const json = await res.json()
      const quote = json['Global Quote']

      if (!quote || !quote['05. price']) {
        setError('Ticker not found. Try AAPL, MSFT, or NVDA.')
        return
      }

      setData({
        symbol:     quote['01. symbol'],
        price:      parseFloat(quote['05. price']).toFixed(2),
        change:     parseFloat(quote['09. change']).toFixed(2),
        changePct:  quote['10. change percent'],
        volume:     parseInt(quote['06. volume']).toLocaleString(),
        high:       parseFloat(quote['03. high']).toFixed(2),
        low:        parseFloat(quote['04. low']).toFixed(2),
        prevClose:  parseFloat(quote['08. previous close']).toFixed(2),
      })
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isPositive = data && parseFloat(data.change) >= 0

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">StockIQ</h1>
          <p className="text-gray-500 mt-1">Real-time stock analysis</p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchStock()}
            placeholder="Enter ticker symbol (e.g. AAPL)"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 
                       bg-white text-gray-800 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       text-sm font-mono uppercase"
          />
          <button
            onClick={searchStock}
            disabled={loading}
            className="px-5 py-3 bg-gray-900 text-white rounded-xl
                       hover:bg-gray-700 transition-colors disabled:opacity-50
                       flex items-center gap-2 text-sm font-medium"
          >
            <Search size={16} />
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        {/* Quick picks */}
        <div className="flex gap-2 mb-8">
          {['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META'].map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); }}
              className="px-3 py-1.5 text-xs font-mono font-medium
                         border border-gray-200 rounded-lg bg-white
                         text-gray-600 hover:border-gray-400 
                         hover:text-gray-800 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 
                          rounded-xl text-red-600 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Stock card */}
        {data && (
          <div className="bg-white rounded-2xl border border-gray-100 
                          shadow-sm p-6">
            {/* Top row */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-sm text-gray-400 font-medium mb-1">
                  {data.symbol}
                </div>
                <div className="text-4xl font-bold text-gray-900">
                  ${data.price}
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold
                ${isPositive 
                  ? 'bg-green-50 text-green-700' 
                  : 'bg-red-50 text-red-700'}`}>
                {isPositive ? '+' : ''}{data.change} ({data.changePct})
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Volume',     data.volume],
                ["Today's High", `$${data.high}`],
                ["Today's Low",  `$${data.low}`],
                ['Prev. Close', `$${data.prevClose}`],
              ].map(([label, value]) => (
                <div key={label} 
                     className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 mt-4 text-center">
              Data provided by Alpha Vantage · Not financial advice
            </p>
          </div>
        )}

      </div>
    </main>
  )
}