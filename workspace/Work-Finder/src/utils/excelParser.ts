import * as XLSX from 'xlsx';

export interface OrganizationInfo {
  id: string;
  orgName: string;
  url: string;
}

export const parseExcelFile = async (file: File): Promise<OrganizationInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("파일을 읽을 수 없습니다.");

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays to find headers intelligently
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length === 0) {
          resolve([]);
          return;
        }

        const orgs: OrganizationInfo[] = [];
        
        // Find which column is name and which is URL by looking at the first row (headers)
        let nameColIdx = -1;
        let urlColIdx = -1;

        // Try to identify headers from the first few rows (sometimes headers are not perfectly on row 0)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;

          row.forEach((cell, idx) => {
            if (typeof cell !== 'string') return;
            const normalized = cell.trim().toLowerCase();
            if (normalized.includes('이름') || normalized.includes('기관') || normalized.includes('회사') || normalized.includes('부서')) {
              nameColIdx = idx;
            }
            if (normalized.includes('링크') || normalized.includes('url') || normalized.includes('홈페이지') || normalized.includes('웹사이트')) {
              urlColIdx = idx;
            }
          });

          if (nameColIdx !== -1 && urlColIdx !== -1) {
            headerRowIdx = i;
            break;
          }
        }

        // If we couldn't confidently find headers, assume column 0 is name and column 1 is url for simplicity
        if (nameColIdx === -1) nameColIdx = 0;
        // It's possible there is no URL column, but instead links are embedded in the name column
        // We will handle this case during extraction

        // Extract data
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;

          const orgName = row[nameColIdx]?.toString().trim();
          let url = '';
          
          if (urlColIdx !== -1 && row[urlColIdx]) {
              url = row[urlColIdx].toString().trim();
          }

          // If URL is still empty, try to find an embedded hyperlink in the orgName cell (or any cell in that row)
          if (!url && orgName) {
              // Try to find the cell address for the current row and name column
              const cellAddress = XLSX.utils.encode_cell({ r: i, c: nameColIdx });
              const cell = worksheet[cellAddress];
              
              if (cell && cell.l && cell.l.Target) {
                  url = cell.l.Target.toString().trim();
              }
          }

          if (orgName && url) {
            // Check if it's a valid link (not just "-", "없음" etc.)
            // A simple check is that it should contain '.' or 'http'
            if (url.includes('.') || url.includes('http')) {
              // Ensure URL has http protocol
              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = `http://${url}`;
              }

              orgs.push({
                id: `${i}-${orgName.substring(0, 10)}`,
                orgName,
                url
              });
            }
          }
        }

        resolve(orgs);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
};
