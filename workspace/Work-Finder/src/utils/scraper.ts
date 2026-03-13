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
    
    // 1. Check if any keyword exists
    let hasKeyword = false;
    for (const kw of KEYWORDS) {
      if (pageText.includes(kw)) {
        hasKeyword = true;
        break;
      }
    }

    if (!hasKeyword) {
      return { hasKeyword: false, latestDate: null };
    }

    // 2. Find all matching dates
    let match;
    const foundDates: Date[] = [];
    
    // Reset regex index
    DATE_REGEX.lastIndex = 0;
    
    while ((match = DATE_REGEX.exec(pageText)) !== null) {
      const parsedD = parseDateSegments(match[1], match[2], match[3]);
      if (parsedD && parsedD > new Date(2000, 0, 1) && parsedD <= new Date(2100, 0, 1)) {
        foundDates.push(parsedD);
      }
    }

    if (foundDates.length === 0) {
      return { hasKeyword: true, latestDate: null }; // Found keywords but no date
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
