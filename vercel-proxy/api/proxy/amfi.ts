import type { VercelRequest, VercelResponse } from '@vercel/node'

type MFResult = {
  schemeCode: string
  isin: string
  name: string
  nav: number
  date: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  try {
    const { isin } = req.query

    if (!isin || typeof isin !== 'string') {
      return res.status(400).json({
        error: 'Missing isin query param',
      })
    }

    const isinList = isin.split(',').map(i => i.trim()).filter(Boolean)

    if (isinList.length === 0) {
      return res.status(400).json({ error: 'No valid ISINs provided' })
    }
    
    // Fetch AMFI NAV data
    const response = await fetch('https://www.amfiindia.com/spages/NAVAll.txt')

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch AMFI data',
      })
    }

    const text = await response.text()

    const lines = text.split('\n')

    const results: MFResult[] = []

    for (const line of lines) {
      // Skip headers / empty lines
      if (!line.includes(';')) continue

      const parts = line.split(';')

      if (parts.length < 6) continue

      const [
        schemeCode,
        isinDiv,
        isinGrowth,
        schemeName,
        navStr,
        dateStr,
      ] = parts

      const matchIsin =
        isinList.includes(isinDiv) || isinList.includes(isinGrowth)

      if (!matchIsin) continue

      const nav = parseFloat(navStr)

      if (isNaN(nav)) continue

      results.push({
        schemeCode,
        isin: isinList.includes(isinGrowth) ? isinGrowth : isinDiv,
        name: schemeName,
        nav,
        date: formatDate(dateStr),
      })
    }

    // Cache (AMFI updates daily, so aggressive cache is fine)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')

    return res.status(200).json({
      data: results,
    })
  } catch (err) {
    console.error('[amfi proxy error]', err)

    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

// Convert "30-Apr-2026" → "2026-04-30"
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  } catch {
    return dateStr
  }
}