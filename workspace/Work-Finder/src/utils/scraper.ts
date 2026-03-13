export interface ScrapeResult {
  hasKeyword: boolean;
  latestDate: string | null;
  error?: string;
}

const KEYWORDS = ['채용', '공고', '모집'];

// Dates from 2000 to now, matching formats like:
// 2023-10-23, 2023.10.23, 23/10/23, 23년 10월 23일, 2023. 10. 23.
const DATE_REGEX = /(20\d{2}|\d{2})[-./년]\s*(0?[1-9]|1[0-2])[-./월]\s*(0?[1-9]|[12][0-9]|3[01])일?/g;

function parseDateSegments(yearStr: string, monthStr: string, dayStr: string): Date | null {
  try {
    let year = parseInt(yearStr, 10);
    // If year is 2 digits like 23, make it 2023
    if (year < 100) year += 2000;
    
    let month = parseInt(monthStr, 10) - 1; // 0-indexed month
    let day = parseInt(dayStr, 10);
    
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const scrapeWebsite = async (url: string): Promise<ScrapeResult> => {
  try {
    // using allorigins.win for basic CORS proxying (some sites might block it, but it works for many)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy Network Error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.contents) {
      throw new Error(`No contents found at ${url}`);
    }

    const htmlText = data.contents;
    
    // Parse the HTML text properly using DOMParser to avoid searching through source code/scripts
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    
    // Remove scripts, styles and noscripts to just get visible context
    const elementsToRemove = doc.querySelectorAll('script, style, noscript');
    elementsToRemove.forEach(el => el.remove());

    const pageText = doc.body ? doc.body.innerText : '';
    
    // 1. Check globally first to save processing time
    let hasGlobalKeyword = false;
    for (const kw of KEYWORDS) {
      if (pageText.includes(kw)) {
        hasGlobalKeyword = true;
        break;
      }
    }

    // Also check for '채용중' specially as requested
    if (!hasGlobalKeyword && pageText.includes('채용중')) {
        hasGlobalKeyword = true;
    }

    if (!hasGlobalKeyword) {
      return { hasKeyword: false, latestDate: null };
    }

    // 2. Process text line by line with a sliding window
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const EXCLUDE_WORDS = ['합격', '결과', '마감', '취소'];
    const EXTENDED_KEYWORDS = [...KEYWORDS, '채용중'];
    
    const foundDates: Date[] = [];
    const now = new Date();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      
      // Look for dates only in the current line
      DATE_REGEX.lastIndex = 0;
      
      while ((match = DATE_REGEX.exec(line)) !== null) {
        const parsedD = parseDateSegments(match[1], match[2], match[3]);
        if (parsedD && parsedD > new Date(2000, 0, 1) && parsedD <= new Date(2100, 0, 1)) {
          // Check context in a 3-line window
          const windowText = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(' ');
          
          const windowHasKeyword = EXTENDED_KEYWORDS.some(kw => windowText.includes(kw));
          const windowHasExclude = EXCLUDE_WORDS.some(kw => windowText.includes(kw));
          
          if (windowHasKeyword && !windowHasExclude) {
            // Filter by date (within 30 days)
            const diffTime = now.getTime() - parsedD.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            
            // Math.abs handles both past (-30 days) and potential future (+30 days) deadlines
            if (Math.abs(diffDays) <= 30) {
              foundDates.push(parsedD);
            }
          }
        }
      }
    }

    if (foundDates.length === 0) {
      return { hasKeyword: false, latestDate: null }; 
    }

    // Sort descending
    foundDates.sort((a, b) => b.getTime() - a.getTime());
    
    // The most recent date
    const latestDateStr = formatDate(foundDates[0]);

    return {
      hasKeyword: true,
      latestDate: latestDateStr
    };
    
  } catch (error: any) {
    return {
      hasKeyword: false,
      latestDate: null,
      error: error?.message || 'Unknown error'
    };
  }
};
