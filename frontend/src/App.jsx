import { useState, useRef } from 'react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [algorithm, setAlgorithm] = useState('simple');
  const [isConverting, setIsConverting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState(null);
  const [convertedFileName, setConvertedFileName] = useState('');
  const [stats, setStats] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
    setConvertedUrl(null);
    setConvertedFileName('');
    setStats(null);
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

const handleConvert = async () => {
  if (!file) return;

  setIsConverting(true);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('algorithm', algorithm);

  try {
    const response = await fetch('http://127.0.0.1:8000/api/convert', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errMsg = `Server error ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.detail || errMsg;
      } catch (e) { }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const { stats: resStats, image: convertedBase64 } = data;

    let ratioText = "0%";
    const originalSizeByte = resStats.original_size;
    const convertedSizeByte = resStats.converted_size;

    if (originalSizeByte > 0 && convertedSizeByte > 0) {
      const diff = originalSizeByte - convertedSizeByte;
      const percentage = Math.abs((diff / originalSizeByte) * 100).toFixed(1);
      if (diff > 0) ratioText = `${percentage}% smaller`;
      else if (diff < 0) ratioText = `${percentage}% larger`;
      else ratioText = "No change";
    }

    setStats({
      originalFormat: resStats.format.replace('image/', '').toUpperCase(),
      dimensions: `${resStats.width} x ${resStats.height}`,
      originalSize: formatSize(originalSizeByte),
      convertedSize: formatSize(convertedSizeByte),
      ratio: ratioText,
      time: parseFloat(resStats.conversion_time).toFixed(3) + 's'
    });

    setConvertedUrl(convertedBase64);
    setConvertedFileName(`converted_${algorithm}.png`);
  } catch (error) {
    console.error('Conversion error:', error);
    alert(`Conversion failed: ${error.message}`);
  } finally {
    setIsConverting(false);
  }
};

return (
  <div className="app-container">
    <div className="header">
      <h1>PNG Converter</h1>
      <p>Premium Image Transformation & Compression</p>
    </div>

    {!file ? (
      <div
        className={`dropzone ${isDragActive ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <div className="dropzone-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div className="dropzone-text">
          Drag & drop an image here, or <strong>click to browse</strong>
        </div>
      </div>
    ) : convertedUrl ? (
      <div className="preview-comparison">
        <div className="preview-box">
          <span className="preview-label">Before</span>
          <img src={preview} alt="Original" className="preview-image" />
        </div>
        <div className="preview-box">
          <span className="preview-label">After</span>
          <img src={convertedUrl} alt="Converted" className="preview-image" />
        </div>
        <button
          className="remove-btn-absolute"
          onClick={() => { setFile(null); setPreview(null); setConvertedUrl(null); setStats(null); }}
          title="Remove"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    ) : (
      <div className="file-preview">
        <img src={preview} alt="Preview" className="file-thumb" />
        <div className="file-info">
          <div className="file-name">{file.name}</div>
          <div className="file-size">{formatSize(file.size)}</div>
        </div>
        <button
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          onClick={() => { setFile(null); setPreview(null); setStats(null); }}
          title="Remove"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    )}

    <div className="control-group">
      <label className="control-label">Compression Algorithm</label>
      <div className="select-wrapper">
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value)}
          disabled={isConverting}
        >
          <option value="simple">Simple PNG (Deflate)</option>
          <option value="huffman">Huffman Coding Only</option>
          <option value="rle">Run-Length Encoding (RLE)</option>
        </select>
      </div>
    </div>

    {stats && (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.dimensions}</div>
          <div className="stat-label">Dimensions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.originalFormat}</div>
          <div className="stat-label">Orig. Format</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.time}</div>
          <div className="stat-label">Conv. Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.originalSize}</div>
          <div className="stat-label">Original Size</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.convertedSize}</div>
          <div className="stat-label">Converted Size</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: stats.ratio.includes('smaller') ? '#22c55e' : '#ef4444' }}>{stats.ratio}</div>
          <div className="stat-label">Diff Ratio</div>
        </div>
      </div>
    )}

    <div className="action-buttons">
      <button
        className="btn"
        onClick={handleConvert}
        disabled={!file || isConverting}
      >
        {isConverting ? (
          <>
            <div className="spinner"></div>
            Converting...
          </>
        ) : (
          'Convert File'
        )}
      </button>

      {convertedUrl && (
        <a
          href={convertedUrl}
          download={convertedFileName}
          className="btn btn-success"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download
        </a>
      )}
    </div>
  </div>
);
}

export default App;
