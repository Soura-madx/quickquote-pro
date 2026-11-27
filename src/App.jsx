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
  Upload,
  Edit3,
  Copy,
  History,
  FilePlus2,
  X,
  Search
} from 'lucide-react';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'MySecretKey2026';
const DOCS_STORAGE_KEY = 'qq_saved_docs_v1';

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
  return `PRO-${cleanTag}-${computeSignature(cleanTag)}`;
}

function validateSignedKey(fullKey) {
  const parts = fullKey.trim().toUpperCase().split('-');
  if (parts.length !== 3 || parts[0] !== 'PRO') return false;
  return computeSignature(parts[1]) === parts[2];
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

  // Saved Documents History Drawer State
  const [savedDocs, setSavedDocs] = useState(() => {
    try {
      const saved = localStorage.getItem(DOCS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDocId, setEditingDocId] = useState(null);
  const [saveToast, setSaveToast] = useState('');

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

  // Refs & Mobile Preview Scale
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const pdfRef = useRef(null);
  const previewContainerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);

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

  useEffect(() => {
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(savedDocs));
  }, [savedDocs]);

  // Restore saved signature onto canvas
  useEffect(() => {
    if (profile.signatureBase64 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = profile.signatureBase64;
    }
  }, [profile.signatureBase64]);

  // Auto-fit A4 preview cleanly on mobile screens
  useEffect(() => {
    const updateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.offsetWidth;
      const a4Width = 680;
      setPreviewScale(containerWidth < a4Width ? containerWidth / a4Width : 1);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + Number(item.qty) * Number(item.rate), 0);
  const gstAmount = (subtotal * Number(gstRate)) / 100;
  const grandTotal = subtotal + gstAmount;

  const triggerToast = (msg) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 2500);
  };

  // Save or Update Current Quotation/Invoice
  const handleSaveDocument = (silent = false) => {
    const now = new Date().toISOString();
    const docSnapshot = {
      docType,
      docNumber,
      docDate,
      clientName,
      clientPhone,
      clientAddress,
      gstRate,
      items: items.map((item) => ({ ...item })),
      grandTotal,
      updatedAt: now
    };

    if (editingDocId) {
      setSavedDocs((prev) =>
        prev.map((d) => (d.id === editingDocId ? { ...d, ...docSnapshot } : d))
      );
      if (!silent) triggerToast(`Updated ${docNumber}!`);
    } else {
      const newId = `DOC-${Date.now()}`;
      setSavedDocs((prev) => [{ id: newId, createdAt: now, ...docSnapshot }, ...prev]);
      setEditingDocId(newId);
      if (!silent) triggerToast(`Saved ${docNumber}!`);
    }
  };

  // Load a saved document into editor (Edit Mode)
  const handleEditDocument = (doc) => {
    setEditingDocId(doc.id);
    setDocType(doc.docType);
    setDocNumber(doc.docNumber);
    setDocDate(doc.docDate);
    setClientName(doc.clientName);
    setClientPhone(doc.clientPhone || '');
    setClientAddress(doc.clientAddress || '');
    setGstRate(doc.gstRate ?? 18);
    setItems(doc.items.map((item) => ({ ...item })));
    setShowHistoryDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerToast(`Editing ${doc.docNumber}`);
  };

  // Duplicate a saved document as a Revision
  const handleReviseDocument = (doc) => {
    setEditingDocId(null);
    setDocType(doc.docType);
    setDocNumber(`${doc.docNumber}-Rev`);
    setDocDate(new Date().toISOString().split('T')[0]);
    setClientName(doc.clientName);
    setClientPhone(doc.clientPhone || '');
    setClientAddress(doc.clientAddress || '');
    setGstRate(doc.gstRate ?? 18);
    setItems(doc.items.map((item) => ({ ...item })));
    setShowHistoryDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerToast(`Created revision from ${doc.docNumber}`);
  };

  // Start fresh blank document
  const handleNewDocument = () => {
    setEditingDocId(null);
    const nextNum = 101 + savedDocs.length;
    setDocNumber(docType === 'QUOTATION' ? `QT-${nextNum}` : `INV-${nextNum}`);
    setDocDate(new Date().toISOString().split('T')[0]);
    setClientName('');
    setClientPhone('');
    setClientAddress('');
    setItems([{ desc: '', qty: 1, rate: 0 }]);
    triggerToast('Started new blank document');
  };

  const handleDeleteDocument = (id) => {
    setSavedDocs((prev) => prev.filter((d) => d.id !== id));
    if (editingDocId === id) setEditingDocId(null);
  };

  // Filter saved docs in drawer
  const filteredDocs = savedDocs.filter((doc) => {
    const q = searchQuery.toLowerCase();
    return (
      (doc.clientName || '').toLowerCase().includes(q) ||
      (doc.docNumber || '').toLowerCase().includes(q) ||
      (doc.clientPhone || '').includes(q)
    );
  });

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
    if (secretInput !== ADMIN_SECRET) return alert('Incorrect Admin Secret!');
    const key = generateSignedKey(newClientTag || `USER${Math.floor(100 + Math.random() * 900)}`);
    setGeneratedKey(key);
  };

  const exportProfileBackup = () => {
    const backupPayload = { profile, savedDocs };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
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
        if (parsed.profile) {
          setProfile(parsed.profile);
          if (Array.isArray(parsed.savedDocs)) setSavedDocs(parsed.savedDocs);
        } else {
          setProfile(parsed);
        }
        alert('Business profile, signature & saved documents restored!');
      } catch {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfile({ ...profile, logoBase64: reader.result });
    reader.readAsDataURL(file);
  };

  // Accurate Touch & Mouse Coordinates for Signature Box
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e) => {
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setProfile({ ...profile, signatureBase64: canvasRef.current.toDataURL('image/png') });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setProfile({ ...profile, signatureBase64: '' });
  };

  const updateItem = (idx, field, val) => {
    const updated = [...items];
    updated[idx][field] = val;
    setItems(updated);
  };

  const getPdfOptions = () => ({
    margin: 0.3,
    filename: `${docType}_${(clientName || 'Client').replace(/\s+/g, '_')}_${docNumber}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  });

  const downloadPDF = () => {
    handleSaveDocument(true);
    html2pdf().set(getPdfOptions()).from(pdfRef.current).save();
  };

  const shareOnWhatsApp = async () => {
    if (isSharing) return;
    setIsSharing(true);
    handleSaveDocument(true);
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
        window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('Could not share directly. Please use Download PDF and send via WhatsApp.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16 md:pb-6">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-14 right-4 z-50 bg-slate-900 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow-lg border border-slate-700">
          {saveToast}
        </div>
      )}

      {/* Compact Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white px-3.5 py-2.5 shadow-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400 shrink-0" />
          <span className="font-bold text-base tracking-tight">QuickQuote Pro</span>
          {isPro ? (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" /> PRO
            </span>
          ) : (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
              DEMO
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* History Button (Works on both Mobile & Desktop) */}
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-700 transition"
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            <span>History</span>
            {savedDocs.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {savedDocs.length}
              </span>
            )}
          </button>

          {!isPro && (
            <button
              onClick={() => setShowLicenseModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
            >
              <Key className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Unlock Pro</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={downloadPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
            <button
              onClick={shareOnWhatsApp}
              disabled={isSharing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <Share2 className="w-3.5 h-3.5" /> {isSharing ? 'Preparing...' : 'Send on WhatsApp'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace (Clean & Uncluttered) */}
      <main className="max-w-7xl mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT PANEL: Compact Editor Controls */}
        <div className="lg:col-span-5 space-y-3">
          {/* 1. Document Type & Meta */}
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-1 gap-1.5">
                {['QUOTATION', 'TAX INVOICE'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setDocType(type)}
                    className={`flex-1 py-1.5 rounded-lg font-semibold text-xs transition ${
                      docType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={handleNewDocument}
                title="Create New Blank Document"
                className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <FilePlus2 className="w-3.5 h-3.5" /> New
              </button>
            </div>

            {editingDocId && (
              <div className="bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-amber-800">
                <span>
                  Editing saved <strong>{docNumber}</strong>
                </span>
                <button
                  onClick={() => setEditingDocId(null)}
                  className="underline font-semibold text-amber-900"
                >
                  Save as New
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-slate-500">Document No.</label>
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">Date</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* 2. Client Details */}
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-2">
            <h2 className="font-bold text-xs sm:text-sm text-slate-700">Client Details (Bill To)</h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Client / Party Name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
              />
              <input
                type="tel"
                placeholder="Client WhatsApp No."
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
              />
              <input
                placeholder="Client City / Address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm col-span-2"
              />
            </div>
          </div>

          {/* 3. Compact Line Items & GST */}
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xs sm:text-sm text-slate-700">Items & Services</h2>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 font-medium"
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
                  className="col-span-6 px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                  className="col-span-2 px-1.5 py-1.5 border border-slate-300 rounded-lg text-xs text-center"
                />
                <input
                  type="number"
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                  className="col-span-3 px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-right"
                />
                <button
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="col-span-1 text-rose-500 flex justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={() => setItems([...items, { desc: '', qty: 1, rate: 0 }])}
                className="flex-1 py-1.5 border border-dashed border-blue-400 text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
              <button
                onClick={() => handleSaveDocument(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-slate-800"
              >
                <Save className="w-3.5 h-3.5" /> {editingDocId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

          {/* 4. Business Profile & Enlarged Signature Box */}
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-slate-700">
                <Building2 className="w-4 h-4 text-blue-600" /> Your Business & Signature
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportProfileBackup}
                  className="text-[11px] text-slate-600 hover:text-blue-600 flex items-center gap-1"
                >
                  <Save className="w-3 h-3" /> Backup
                </button>
                <label className="text-[11px] text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3 h-3" /> Restore
                  <input type="file" accept=".json" onChange={importProfileBackup} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Company Name"
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm col-span-2"
              />
              <input
                placeholder="GSTIN (Optional)"
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
              />
              <input
                placeholder="Phone Number"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
              />
              <input
                placeholder="Office Address"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm col-span-2"
              />
              <input
                placeholder="UPI / Bank Details"
                value={profile.bankDetails}
                onChange={(e) => setProfile({ ...profile, bankDetails: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm col-span-2"
              />
            </div>

            {/* Logo & Color Theme */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label className="text-xs bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer font-medium">
                Upload Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Brand Color:</span>
                <input
                  type="color"
                  value={profile.brandColor}
                  onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border-0"
                />
              </div>
            </div>

            {/* Digital Signature Pad */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">Draw Digital Signature Below:</span>
                <button onClick={clearSignature} className="text-xs text-rose-600 flex items-center gap-1">
                  <Eraser className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={440}
                height={150}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                className="w-full h-32 border-2 border-dashed border-slate-400 rounded-lg bg-slate-50 touch-none cursor-crosshair"
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Clean Auto-Fit A4 Preview */}
        <div className="lg:col-span-7">
          <div
            ref={previewContainerRef}
            className="bg-white shadow-md rounded-xl overflow-hidden border border-slate-200"
            style={{ height: `${840 * previewScale}px` }}
          >
            <div
              style={{
                width: '680px',
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left'
              }}
            >
              <div
                ref={pdfRef}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  width: '680px',
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
                        style={{ height: '64px', margin: '0 auto', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ height: '64px', width: '140px', borderBottom: '1px solid #cbd5e1', margin: '0 auto' }} />
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
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        Powered by QuickQuote Pro •{' '}
        <button onClick={() => setShowAdminModal(true)} className="underline hover:text-slate-600">
          Admin
        </button>
      </footer>

      {/* Compact Sticky Mobile Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2 md:hidden shadow-lg">
        <button
          onClick={() => handleSaveDocument(false)}
          className="bg-slate-800 active:bg-slate-900 text-white font-semibold text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={downloadPDF}
          className="flex-1 bg-blue-600 active:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
        <button
          onClick={shareOnWhatsApp}
          disabled={isSharing}
          className="flex-1 bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" /> {isSharing ? 'Wait...' : 'WhatsApp'}
        </button>
      </div>

      {/* SLIDE-OVER HISTORY DRAWER (Clean & Scalable for 100+ Bills) */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[1px]">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">Saved Bills & Quotations ({savedDocs.length})</h3>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by client name, phone, or QT-101..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  {savedDocs.length === 0
                    ? 'No saved bills yet. Click Save or Download PDF to store them here.'
                    : 'No matching quotation found.'}
                </div>
              ) : (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-3 rounded-xl border transition ${
                      editingDocId === doc.id
                        ? 'border-blue-400 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {doc.docNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">{doc.docType}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 truncate mt-1">
                          {doc.clientName || 'Unnamed Client'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ₹{Number(doc.grandTotal).toLocaleString('en-IN')} • {doc.items.length} items • {doc.docDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleEditDocument(doc)}
                        className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleReviseDocument(doc)}
                        className="flex-1 py-1.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg flex items-center justify-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Duplicate / Revise
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        title="Delete"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* License Key Activation Modal */}
      {showLicenseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Activate Lifetime Pro License</h3>
            <p className="text-xs text-slate-600">
              Enter your Lifetime License Key to remove the demo watermark.
            </p>
            <input
              placeholder="e.g. PRO-SHARMA-8C41A9"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-xs uppercase font-mono"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowLicenseModal(false)} className="px-3 py-1.5 text-xs text-slate-600">
                Cancel
              </button>
              <button
                onClick={handleActivateLicense}
                className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
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
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-2.5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Admin: Generate Client Key</h3>
            <input
              type="password"
              placeholder="Enter ADMIN_SECRET"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-lg text-xs"
            />
            <input
              placeholder="Client Tag (e.g. SHARMA)"
              value={newClientTag}
              onChange={(e) => setNewClientTag(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-lg text-xs uppercase"
            />
            {generatedKey && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <p className="text-[11px] text-emerald-700">New Key Ready:</p>
                <p className="text-base font-mono font-bold text-emerald-900 select-all">{generatedKey}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setGeneratedKey('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600"
              >
                Close
              </button>
              <button
                onClick={handleGenerateKey}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}