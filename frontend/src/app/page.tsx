'use client'

import { useState } from 'react'
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

interface NewsItem {
  title: string
  url: string
  source: string
  publishedAt: string
  sentiment: string
  sentimentScore: number
}

type Period = '1D' | '5D' | '1M' | '1Y' | '5Y'

export default function Home() {
  const [ticker, setTicker]         = useState('')
  const [data, setData]             = useState<any>(null)
  const [chartData, setChartData]   = useState<any[]>([])
  const [news, setNews]             = useState<NewsItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError]           = useState('')
  const [activePeriod, setActivePeriod] = useState<Period>('1M')
  const [currentTicker, setCurrentTicker] = useState('')

  const KEYS = [
    process.env.NEXT_PUBLIC_AV_KEY_1,
    process.env.NEXT_PUBLIC_AV_KEY_2,
    process.env.NEXT_PUBLIC_AV_KEY_3,
    process.env.NEXT_PUBLIC_AV_KEY_4,
    process.env.NEXT_PUBLIC_AV_KEY_5,
  ]
  const getKey = () => KEYS[Math.floor(Math.random() * KEYS.length)]

  // ── Fetch chart data for a given period ──────────────────
  async function fetchChart(sym: string, period: Period) {
    setChartLoading(true)
    try {
      let url = ''
      let parsed: any[] = []

      if (period === '1D') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${sym}&interval=5min&outputsize=compact&apikey=${getKey()}`
        const res  = await fetch(url)
        const json = await res.json()
        const ts   = json['Time Series (5min)']
        if (ts) {
          parsed = Object.entries(ts)
            .slice(0, 78)   // ~6.5 hours of trading
            .reverse()
            .map(([time, v]: [string, any]) => ({
              date:  time.slice(11, 16),  // HH:MM
              close: parseFloat(v['4. close']),
            }))
        }

      } else if (period === '5D') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${sym}&interval=30min&outputsize=full&apikey=${getKey()}`
        const res  = await fetch(url)
        const json = await res.json()
        const ts   = json['Time Series (30min)']
        if (ts) {
          parsed = Object.entries(ts)
            .slice(0, 65)   // ~5 trading days at 30min
            .reverse()
            .map(([time, v]: [string, any]) => ({
              date:  time.slice(5, 16),   // MM-DD HH:MM
              close: parseFloat(v['4. close']),
            }))
        }

      } else if (period === '1M') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&outputsize=compact&apikey=${getKey()}`
        const res  = await fetch(url)
        const json = await res.json()
        const ts   = json['Time Series (Daily)']
        if (ts) {
          parsed = Object.entries(ts)
            .slice(0, 30)
            .reverse()
            .map(([date, v]: [string, any]) => ({
              date:  date.slice(5),
              close: parseFloat(v['4. close']),
            }))
        }

      } else if (period === '1Y') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&outputsize=full&apikey=${getKey()}`
        const res  = await fetch(url)
        const json = await res.json()
        const ts   = json['Time Series (Daily)']
        if (ts) {
          parsed = Object.entries(ts)
            .slice(0, 252)  // ~1 trading year
            .reverse()
            .map(([date, v]: [string, any]) => ({
              date:  date.slice(5),
              close: parseFloat(v['4. close']),
            }))
        }

      } else if (period === '5Y') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${sym}&apikey=${getKey()}`
        const res  = await fetch(url)
        const json = await res.json()
        const ts   = json['Weekly Adjusted Time Series']
        if (ts) {
          parsed = Object.entries(ts)
            .slice(0, 260)  // 5 years of weekly data
            .reverse()
            .map(([date, v]: [string, any]) => ({
              date:  date.slice(0, 7),    // YYYY-MM
              close: parseFloat(v['5. adjusted close']),
            }))
        }
      }

      setChartData(parsed)
    } catch (e) {
      console.error('Chart fetch error', e)
    } finally {
      setChartLoading(false)
    }
  }

  // ── Handle period button click ────────────────────────────
  async function handlePeriod(period: Period) {
    setActivePeriod(period)
    if (currentTicker) {
      await fetchChart(currentTicker, period)
    }
  }

  // ── Main search ───────────────────────────────────────────
  async function searchStock() {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    setData(null)
    setChartData([])
    setNews([])

    const sym = ticker.toUpperCase()

    try {
      // 1. Live quote
      const quoteRes  = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${getKey()}`
      )
      const quoteJson = await quoteRes.json()
      const quote     = quoteJson['Global Quote']

      if (!quote || !quote['05. price']) {
        setError('Ticker not found. Try AAPL, MSFT, or NVDA.')
        setLoading(false)
        return
      }

      setData({
        symbol:    quote['01. symbol'],
        price:     parseFloat(quote['05. price']).toFixed(2),
        change:    parseFloat(quote['09. change']).toFixed(2),
        changePct: quote['10. change percent'],
        volume:    parseInt(quote['06. volume']).toLocaleString(),
        high:      parseFloat(quote['03. high']).toFixed(2),
        low:       parseFloat(quote['04. low']).toFixed(2),
        prevClose: parseFloat(quote['08. previous close']).toFixed(2),
      })

      setCurrentTicker(sym)

      // 2. Chart (default 1M)
      await fetchChart(sym, activePeriod)

      // 3. News + sentiment
      const newsRes  = await fetch(
        `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${sym}&limit=10&apikey=${getKey()}`
      )
      const newsJson = await newsRes.json()
      const feed     = newsJson['feed']

      if (feed && feed.length > 0) {
        const parsed: NewsItem[] = feed.slice(0, 8).map((item: any) => {
          const ts    = item.ticker_sentiment?.find((t: any) => t.ticker === sym)
          const score = ts
            ? parseFloat(ts.ticker_sentiment_score)
            : parseFloat(item.overall_sentiment_score || '0')
          const label = ts
            ? ts.ticker_sentiment_label
            : item.overall_sentiment_label || 'Neutral'
          return {
            title:          item.title,
            url:            item.url,
            source:         item.source,
            publishedAt:    item.time_published?.slice(0, 8) || '',
            sentiment:      label,
            sentimentScore: score,
          }
        })
        setNews(parsed)
      }

    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isPositive   = data && parseFloat(data.change) >= 0
  const posCount     = news.filter(n => n.sentiment.toLowerCase().includes('bullish') || n.sentiment.toLowerCase().includes('positive')).length
  const negCount     = news.filter(n => n.sentiment.toLowerCase().includes('bearish') || n.sentiment.toLowerCase().includes('negative')).length
  const neuCount     = news.length - posCount - negCount
  const avgSentiment = news.length > 0
    ? news.reduce((s, n) => s + n.sentimentScore, 0) / news.length : 0
  const overallLabel = avgSentiment > 0.15 ? 'Positive'
    : avgSentiment < -0.15 ? 'Negative' : 'Neutral'

  function SentimentBadge({ label }: { label: string }) {
    const l     = label.toLowerCase()
    const isBull = l.includes('bullish') || l.includes('positive')
    const isBear = l.includes('bearish') || l.includes('negative')
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                        text-xs font-semibold whitespace-nowrap
        ${isBull ? 'bg-green-50 text-green-700' :
          isBear ? 'bg-red-50 text-red-700' :
                   'bg-gray-100 text-gray-500'}`}>
        {isBull ? <TrendingUp size={10} /> :
         isBear ? <TrendingDown size={10} /> :
                  <Minus size={10} />}
        {label}
      </span>
    )
  }

  const PERIODS: Period[] = ['1D', '5D', '1M', '1Y', '5Y']

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">StockIQ</h1>
          <p className="text-gray-500 mt-1">Real-time stock analysis and news sentiment</p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
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
          <button onClick={searchStock} disabled={loading}
            className="px-5 py-3 bg-gray-900 text-white rounded-xl
                       hover:bg-gray-700 transition-colors disabled:opacity-50
                       flex items-center gap-2 text-sm font-medium">
            <Search size={16} />
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        {/* Quick picks */}
        <div className="flex gap-2 mb-8">
          {['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META'].map(t => (
            <button key={t} onClick={() => setTicker(t)}
              className="px-3 py-1.5 text-xs font-mono font-medium
                         border border-gray-200 rounded-lg bg-white
                         text-gray-600 hover:border-gray-400
                         hover:text-gray-800 transition-colors">
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
                          shadow-sm p-6 mb-6">
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
                ${isPositive ? 'bg-green-50 text-green-700'
                             : 'bg-red-50 text-red-700'}`}>
                {isPositive ? '+' : ''}{data.change} ({data.changePct})
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Volume',       data.volume],
                ["Today's High", `$${data.high}`],
                ["Today's Low",  `$${data.low}`],
                ['Prev. Close',  `$${data.prevClose}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        {(chartData.length > 0 || chartLoading) && (
          <div className="bg-white rounded-2xl border border-gray-100
                          shadow-sm p-6 mb-6">
            {/* Period selector */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500">
                PRICE HISTORY
              </h2>
              <div className="flex gap-1">
                {PERIODS.map(p => (
                  <button key={p} onClick={() => handlePeriod(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold
                                transition-colors
                      ${activePeriod === p
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {chartLoading ? (
              <div className="h-60 flex items-center justify-center
                              text-gray-400 text-sm">
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    interval={Math.floor(chartData.length / 6)} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v}`}
                    domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v: any) => [`$${v}`, 'Price']}
                    contentStyle={{ borderRadius: '8px',
                      border: '1px solid #e5e7eb', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="close"
                    stroke={isPositive ? '#16a34a' : '#dc2626'}
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-400 mt-3 text-center">
              Data provided by Alpha Vantage · Not financial advice
            </p>
          </div>
        )}

        {/* Sentiment */}
        {news.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100
                          shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">
              NEWS SENTIMENT
            </h2>
            <div className="flex items-center gap-4 mb-4 p-4
                            bg-gray-50 rounded-xl">
              <div className={`text-2xl font-bold
                ${overallLabel === 'Positive' ? 'text-green-600' :
                  overallLabel === 'Negative' ? 'text-red-600' :
                                                'text-gray-500'}`}>
                {overallLabel}
              </div>
              <div className="text-sm text-gray-400">
                Based on {news.length} recent articles
              </div>
              <div className="ml-auto flex gap-3 text-xs font-medium">
                <span className="text-green-600">{posCount} positive</span>
                <span className="text-gray-400">{neuCount} neutral</span>
                <span className="text-red-600">{negCount} negative</span>
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden mb-5">
              <div className="bg-green-400"
                style={{ width: `${(posCount / news.length) * 100}%` }} />
              <div className="bg-gray-200"
                style={{ width: `${(neuCount / news.length) * 100}%` }} />
              <div className="bg-red-400"
                style={{ width: `${(negCount / news.length) * 100}%` }} />
            </div>
            <div className="space-y-4">
              {news.map((item, i) => (
                <div key={i}
                  className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-800
                                 hover:text-blue-600 transition-colors
                                 leading-snug">
                      {item.title}
                    </a>
                    <SentimentBadge label={item.sentiment} />
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.source} · {item.publishedAt}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Sentiment powered by Alpha Vantage · Not financial advice
            </p>
          </div>
        )}

      </div>
    </main>
  )
}