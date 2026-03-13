import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Search, Building2, ExternalLink, AlertCircle } from 'lucide-react';
import { parseExcelFile, type OrganizationInfo } from './utils/excelParser';
import { scrapeWebsite, type ScrapeResult } from './utils/scraper';
import './App.css';

interface DisplayResult extends OrganizationInfo {
  latestDate: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
      setFile(selectedFile);
      setErrorMsg('');
      setResults([]);
      setProgress(0);
      setStatusMsg('');
    } else {
      setErrorMsg('지원하지 않는 파일 형식입니다. 엑셀 파일(.xlsx, .xls)을 업로드해주세요.');
    }
  };

  const handleStartProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg('');
    setResults([]);
    setProgress(0);
    setStatusMsg('엑셀 파일을 분석 중입니다...');

    try {
      const orgs = await parseExcelFile(file);
      
      if (orgs.length === 0) {
        setErrorMsg('엑셀 파일에서 유효한 데이터를 찾을 수 없습니다.');
        setIsProcessing(false);
        return;
      }

      const foundResults: DisplayResult[] = [];
      const total = orgs.length;

      for (let i = 0; i < total; i++) {
        const org: OrganizationInfo = orgs[i];
        setStatusMsg(`[${i + 1}/${total}] ${org.orgName} 웹사이트 확인 중...`);
        
        const scrapeInfo: ScrapeResult = await scrapeWebsite(org.url);
        
        if (scrapeInfo.hasKeyword && scrapeInfo.latestDate) {
          foundResults.push({
            ...org,
            latestDate: scrapeInfo.latestDate
          });
          // Update partial results immediately for better UX
          setResults([...foundResults]);
        }

        setProgress(Math.round(((i + 1) / total) * 100));
        
        // Artificial delay to prevent overwhelming the proxy server
        await new Promise(res => setTimeout(res, 300));
      }

      // Sort by latest date descending
      foundResults.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
      setResults(foundResults);
      setStatusMsg('모든 확인 작업이 완료되었습니다.');
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="header-title">
          <Search size={40} color="var(--primary-color)" />
          <span>채용공고 어그리게이터</span>
        </h1>
        <p className="header-subtitle">
          여러 기관 웹사이트를 한 번에 방문하여 채용, 공고, 모집 관련 최신 소식을 모아보세요.
        </p>
      </header>

      <main className="main-content">
        {/* Upload & Controls Section */}
        <section className="glass-panel upload-section">
          <h2 className="section-title">
            <FileSpreadsheet size={24} />
            데이터 업로드
          </h2>
          
          <div 
            className={`file-upload-box ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              className="file-input" 
              accept=".xlsx,.xls" 
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <UploadCloud className="upload-icon" />
            <p className="upload-text">엑셀 파일을 이곳으로 드래그하거나 클릭하세요</p>
            <p className="upload-hint">지원 형식: .xlsx, .xls</p>
          </div>

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          {file && !errorMsg && (
            <div className="selected-file-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={16} color="var(--success-color)" />
                <span className="file-name">{file.name}</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          <button 
            className="btn-primary" 
            onClick={handleStartProcess}
            disabled={!file || isProcessing || !!errorMsg}
          >
            {isProcessing ? (
              <>
                <Search className="animate-spin" size={20} />
                공고 확인 중... {progress}%
              </>
            ) : (
              <>
                <Search size={20} />
                공고확인 시작
              </>
            )}
          </button>

          {isProcessing && (
            <div className="progress-container">
              <div className="progress-header">
                <span>진행 상황</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="status-text">{statusMsg}</p>
            </div>
          )}
          {!isProcessing && statusMsg && (
             <p className="status-text" style={{ color: 'var(--success-color)' }}>{statusMsg}</p>
          )}
        </section>

        {/* Results Section */}
        <section className="glass-panel results-section">
          <div className="results-header">
            <h2 className="section-title">
              <Building2 size={24} />
              검색 결과
            </h2>
            {results.length > 0 && (
              <span className="results-count">발견 완료: {results.length}건</span>
            )}
          </div>

          <div className="results-grid">
            {results.length > 0 ? (
              results.map((result) => (
                <div key={result.id} className="result-card">
                  <div className="card-header">
                    <h3 className="org-name">{result.orgName}</h3>
                    <span className="badge">신규 공고</span>
                  </div>
                  
                  <div className="card-meta">
                    <span style={{ fontWeight: 600 }}>최신 등록일:</span>
                    <span>{result.latestDate}</span>
                  </div>

                  <div className="card-action">
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-link"
                    >
                      홈페이지 바로가기
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <Search className="empty-icon" />
                <p>
                  {statusMsg === '모든 확인 작업이 완료되었습니다.' 
                    ? '관련 키워드가 포함된 공고를 찾을 수 없습니다.' 
                    : '아직 검색 결과가 없습니다.'}
                </p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {statusMsg === '모든 확인 작업이 완료되었습니다.'
                    ? '다른 엑셀 파일을 시도해보세요.'
                    : '엑셀 파일을 업로드하고 공고확인을 시작해주세요.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
