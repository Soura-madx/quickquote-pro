import React, { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import {
  Download,
  Share2,
  Plus,
  Trash2,
  Key,
  ShieldCheck,
  Eraser,
  Building2,
  FileText,
  Save,
  Upload
} from 'lucide-react';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'MySecretKey2026';

// Deterministic hash generator (works 100% offline without a database)
function computeSignature(tag) {
  const raw = `${tag.toUpperCase()}::${ADMIN_SECRET}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
}

function generateSignedKey(clientTag) {
  const cleanTag = clientTag.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'CLIENT';
  const sig = computeSignature(cleanTag);
  return `PRO-${cleanTag}-${sig}`;
}

function validateSignedKey(fullKey) {
  const parts = fullKey.trim().toUpperCase().split('-');
  if (parts.length !== 3 || parts[0] !== 'PRO') return false;
  const [, tag, sig] = parts;
  return computeSignature(tag) === sig;
}

export default function App() {
  // License State
  const [licenseKey, setLicenseKey] = useState(localStorage.getItem('qq_license') || '');
  const [isPro, setIsPro] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  // Admin Key Generator Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [newClientTag, setNewClientTag] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');

  // Business Profile State
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('qq_profile');
    return saved
      ? JSON.parse(saved)
      : {
          companyName: 'Apex Interiors & Solutions',
          gstin: '23AABCU9603R1ZM',
          address: '204, Vijay Nagar, Indore, MP',
          phone: '+91 98765 43210',
          bankDetails: 'UPI: apex@okaxis | Bank: HDFC A/C 502000123456',
          logoBase64: '',
          signatureBase64: '',
          brandColor: '#1e3a8a'
        };
  });

  // Document State
  const [docType, setDocType] = useState('QUOTATION');
  const [docNumber, setDocNumber] = useState('QT-101');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientName, setClientName] = useState('Sharma Enterprises');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('MG Road, Bhopal');
  const [gstRate, setGstRate] = useState(18);
  const [items, setItems] = useState([
    { desc: 'Modular Office Workstation Setup', qty: 2, rate: 15000 },
    { desc: 'LED Lighting & Electrical Fitting', qty: 1, rate: 8500 }
  ]);

  // Refs
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const pdfRef = useRef(null);

  // Verify saved license on mount
  useEffect(() => {
    if (licenseKey && validateSignedKey(licenseKey)) {
      setIsPro(true);
    } else {
      localStorage.removeItem('qq_license');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('qq_profile', JSON.stringify(profile));
  }, [profile]);

  const handleActivateLicense = () => {
    if (validateSignedKey(keyInput)) {
      const clean = keyInput.trim().toUpperCase();
      setIsPro(true);
      setLicenseKey(clean);
      localStorage.setItem('qq_license', clean);
      setShowLicenseModal(false);
      alert('Pro Lifetime License Activated! Watermark removed.');
    } else {
      alert('Invalid License Key. Please check and try again.');
    }
  };

  const handleGenerateKey = () => {
    if (secretInput !== ADMIN_SECRET) {
      return alert('Incorrect Admin Secret!');
    }
    const key = generateSignedKey(newClientTag || `USER${Math.floor(100 + Math.random() * 900)}`);
    setGeneratedKey(key);
  };

  // Backup & Restore Business Profile JSON
  const exportProfileBackup = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(profile.companyName || 'business').replace(/\s+/g, '_')}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfileBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setProfile(parsed);
        alert('Business profile & signature restored!');
      } catch {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  // Logo Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfile({ ...profile, logoBase64: reader.result });
    reader.readAsDataURL(file);
  };

  // Signature Drawing Handlers
  const startDraw = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setProfile({ ...profile, signatureBase64: dataUrl });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setProfile({ ...profile, signatureBase64: '' });
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + Number(item.qty) * Number(item.rate), 0);
  const gstAmount = (subtotal * Number(gstRate)) / 100;
  const grandTotal = subtotal + gstAmount;

  const updateItem = (idx, field, val) => {
    const updated = [...items];
    updated[idx][field] = val;
    setItems(updated);
  };

  const getPdfOptions = () => ({
    margin: 0.3,
    filename: `${docType}_${clientName.replace(/\s+/g, '_')}_${docNumber}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  });

  // Download PDF
  const downloadPDF = () => {
    html2pdf().set(getPdfOptions()).from(pdfRef.current).save();
  };

  // Direct PDF File Share on WhatsApp (Mobile Native Share + Desktop Fallback)
  const shareOnWhatsApp = async () => {
    const opt = getPdfOptions();
    try {
      const pdfBlob = await html2pdf().set(opt).from(pdfRef.current).outputPdf('blob');
      const pdfFile = new File([pdfBlob], opt.filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `${docType} - ${profile.companyName}`,
          text: `Hello ${clientName}, please find attached ${docType} (${docNumber}) from ${profile.companyName}.`
        });
      } else {
        html2pdf().set(opt).from(pdfRef.current).save();
        const msg = `Hello ${clientName},\n\nPlease find your *${docType} (${docNumber})* from *${profile.companyName}*.\n*Total Amount:* ₹${grandTotal.toLocaleString('en-IN')}\n\n(Attaching the downloaded PDF file)`;
        const url = `https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('Could not share directly. Please use Download PDF and send via WhatsApp.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-lg tracking-tight">QuickQuote Pro</span>
          {isPro ? (
            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> PRO LIFETIME
            </span>
          ) : (
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
              FREE DEMO MODE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isPro && (
            <button
              onClick={() => setShowLicenseModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <Key className="w-4 h-4" /> Unlock Pro
            </button>
          )}
          <button
            onClick={downloadPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={shareOnWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
          >
            <Share2 className="w-4 h-4" /> Send on WhatsApp
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANEL: Editor Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Document Type & Meta */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex gap-2">
              {['QUOTATION', 'TAX INVOICE'].map((type) => (
                <button
                  key={type}
                  onClick={() => setDocType(type)}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                    docType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Document No.</label>
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Date</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* 2. Company Profile & Digital Sign */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm flex items-center gap-1.5 text-slate-700">
                <Building2 className="w-4 h-4 text-blue-600" /> Your Business & Signature
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportProfileBackup}
                  title="Download Profile Backup"
                  className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> Backup
                </button>
                <label
                  title="Restore Profile Backup"
                  className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Restore
                  <input type="file" accept=".json" onChange={importProfileBackup} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Company Name"
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="px-3 py-1.5 border rounded-lg text-sm col-span-2"
              />
              <input
                placeholder="GSTIN (Optional)"
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
              <input
                placeholder="Phone Number"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
              <input
                placeholder="Office Address"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="px-3 py-1.5 border rounded-lg text-sm col-span-2"
              />
              <input
                placeholder="UPI / Bank Details"
                value={profile.bankDetails}
                onChange={(e) => setProfile({ ...profile, bankDetails: e.target.value })}
                className="px-3 py-1.5 border rounded-lg text-sm col-span-2"
              />
            </div>

            {/* Logo & Color Theme */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg cursor-pointer font-medium">
                Upload Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Brand Color:</span>
                <input
                  type="color"
                  value={profile.brandColor}
                  onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
              </div>
            </div>

            {/* Live Digital Signature Pad */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">Draw Digital Signature Below:</span>
                <button onClick={clearSignature} className="text-xs text-rose-600 flex items-center gap-1">
                  <Eraser className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={320}
                height={80}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                className="w-full h-20 border border-dashed border-slate-400 rounded-lg bg-slate-50 touch-none cursor-crosshair"
              />
            </div>
          </div>

          {/* 3. Client Details */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
            <h2 className="font-bold text-sm text-slate-700">Client Details (Bill To)</h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Client / Party Name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
              <input
                placeholder="Client WhatsApp No."
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
              <input
                placeholder="Client City / Address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm col-span-2"
              />
            </div>
          </div>

          {/* 4. Line Items & GST */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-700">Items & Services</h2>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="text-xs border rounded-lg px-2 py-1 font-medium"
              >
                <option value={0}>No GST (0%)</option>
                <option value={5}>GST 5%</option>
                <option value={12}>GST 12%</option>
                <option value={18}>GST 18%</option>
                <option value={28}>GST 28%</option>
              </select>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                <input
                  placeholder="Item description"
                  value={item.desc}
                  onChange={(e) => updateItem(idx, 'desc', e.target.value)}
                  className="col-span-6 px-2.5 py-1.5 border rounded-lg text-xs"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                  className="col-span-2 px-2 py-1.5 border rounded-lg text-xs text-center"
                />
                <input
                  type="number"
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                  className="col-span-3 px-2 py-1.5 border rounded-lg text-xs text-right"
                />
                <button
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="col-span-1 text-rose-500 flex justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setItems([...items, { desc: '', qty: 1, rate: 0 }])}
              className="w-full py-1.5 border border-dashed border-blue-400 text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Item
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Live A4 Corporate PDF Preview (Pure Hex Colors for html2pdf) */}
        <div className="lg:col-span-7">
          <div className="bg-white shadow-lg rounded-xl overflow-x-auto border border-slate-200">
            <div
              ref={pdfRef}
              style={{
                backgroundColor: '#ffffff',
                color: '#1e293b',
                minWidth: '680px',
                minHeight: '840px',
                padding: '32px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              {/* Watermark if NOT Pro */}
              {!isPro && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    opacity: 0.14,
                    transform: 'rotate(-30deg)'
                  }}
                >
                  <span
                    style={{
                      fontSize: '48px',
                      fontWeight: 900,
                      color: '#0f172a',
                      border: '4px solid #0f172a',
                      padding: '8px 24px'
                    }}
                  >
                    DEMO PREVIEW
                  </span>
                </div>
              )}

              <div>
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: `2px solid ${profile.brandColor}`,
                    paddingBottom: '20px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {profile.logoBase64 && (
                      <img
                        src={profile.logoBase64}
                        alt="Logo"
                        style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '4px' }}
                      />
                    )}
                    <div>
                      <h1 style={{ fontSize: '20px', fontWeight: 800, color: profile.brandColor, margin: 0 }}>
                        {profile.companyName || 'Your Company Name'}
                      </h1>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0' }}>{profile.address}</p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0' }}>Phone: {profile.phone}</p>
                      {profile.gstin && (
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginTop: '4px' }}>
                          GSTIN: {profile.gstin}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        backgroundColor: profile.brandColor,
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {docType}
                    </span>
                    <p style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px', marginBottom: '2px' }}>#{docNumber}</p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Date: {docDate}</p>
                  </div>
                </div>

                {/* Bill To */}
                <div
                  style={{
                    marginTop: '20px',
                    backgroundColor: '#f8fafc',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <p style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
                    Prepared For:
                  </p>
                  <p style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b', margin: '2px 0' }}>{clientName}</p>
                  <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0' }}>{clientAddress}</p>
                  {clientPhone && (
                    <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0' }}>Contact: {clientPhone}</p>
                  )}
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', marginTop: '24px', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: profile.brandColor, color: '#ffffff', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px', borderTopLeftRadius: '6px' }}>#</th>
                      <th style={{ padding: '10px 12px' }}>Description</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', borderTopRightRadius: '6px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '14px' }}>
                    {items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.desc || '-'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{Number(item.rate).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          ₹{(Number(item.qty) * Number(item.rate)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '260px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '6px' }}>
                      <span>Subtotal:</span>
                      <span>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {gstRate > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '6px' }}>
                        <span>GST ({gstRate}%):</span>
                        <span>₹{gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 800,
                        fontSize: '16px',
                        paddingTop: '8px',
                        borderTop: `2px solid ${profile.brandColor}`,
                        color: profile.brandColor
                      }}
                    >
                      <span>Grand Total:</span>
                      <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Bank Details & Digital Signature */}
              <div
                style={{
                  marginTop: '40px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end'
                }}
              >
                <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '300px' }}>
                  <p style={{ fontWeight: 700, color: '#334155', marginBottom: '2px' }}>Payment & Terms:</p>
                  <p style={{ margin: 0 }}>{profile.bankDetails}</p>
                  <p style={{ marginTop: '4px', fontSize: '11px' }}>Thank you for your business!</p>
                </div>

                <div style={{ textAlign: 'center' }}>
                  {profile.signatureBase64 ? (
                    <img
                      src={profile.signatureBase64}
                      alt="Signature"
                      style={{ height: '56px', margin: '0 auto', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ height: '56px', width: '128px', borderBottom: '1px solid #cbd5e1', margin: '0 auto' }} />
                  )}
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginTop: '4px', marginBottom: 0 }}>
                    Authorized Signatory
                  </p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{profile.companyName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        Powered by QuickQuote Pro •{' '}
        <button onClick={() => setShowAdminModal(true)} className="underline hover:text-slate-600">
          Admin
        </button>
      </footer>

      {/* License Key Activation Modal */}
      {showLicenseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Activate Lifetime Pro License</h3>
            <p className="text-xs text-slate-600">
              Enter your Lifetime License Key to remove the demo watermark and unlock clean corporate PDF exports.
            </p>
            <input
              placeholder="e.g. PRO-SHARMA-8C41A9"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm uppercase font-mono"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowLicenseModal(false)} className="px-4 py-2 text-sm text-slate-600">
                Cancel
              </button>
              <button
                onClick={handleActivateLicense}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
              >
                Activate Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Key Generator Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Admin: Generate Client Key</h3>
            <input
              type="password"
              placeholder="Enter ADMIN_SECRET"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <input
              placeholder="Client Tag (e.g. SHARMA)"
              value={newClientTag}
              onChange={(e) => setNewClientTag(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm uppercase"
            />
            {generatedKey && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <p className="text-xs text-emerald-700">New Key Ready (Copy & Send to Client):</p>
                <p className="text-lg font-mono font-bold text-emerald-900 select-all">{generatedKey}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setGeneratedKey('');
                }}
                className="px-4 py-2 text-sm text-slate-600"
              >
                Close
              </button>
              <button onClick={handleGenerateKey} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold">
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}