import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderPlus, Upload, X, Edit2, Trash2, Download, Eye,
  Folder, FileText, Image, File, Search, RefreshCw, Paperclip,
} from 'lucide-react';
import Header from '../components/Header';
import { filesAPI } from '../services/api';

// ── helpers ────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtBytes = (b) => {
  if (!b) return '—';
  if (b < 1024)         return `${b} B`;
  if (b < 1024 * 1024)  return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const SECTION_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b',
];

// ── File type icon ─────────────────────────────────────────────
const FileIcon = ({ mimeType, size = 20, style = {} }) => {
  if (!mimeType) return <File size={size} style={{ color: '#94a3b8', ...style }} />;
  if (mimeType.startsWith('image/'))       return <Image    size={size} style={{ color: '#3b82f6', ...style }} />;
  if (mimeType === 'application/pdf')      return <FileText size={size} style={{ color: '#ef4444', ...style }} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
                                           return <FileText size={size} style={{ color: '#10b981', ...style }} />;
  if (mimeType.includes('word') || mimeType.includes('document'))
                                           return <FileText size={size} style={{ color: '#2563eb', ...style }} />;
  return <File size={size} style={{ color: '#64748b', ...style }} />;
};

// ── Shared modal components ────────────────────────────────────
const Overlay = ({ children, onClose }) => (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    {children}
  </div>
);

const ModalBox = ({ children, width = 460 }) => (
  <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
    {children}
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
      <X size={20} />
    </button>
  </div>
);

// ── Section Form Modal ─────────────────────────────────────────
const SectionModal = ({ initial, onSave, onClose, saving, error }) => {
  const [form, setForm] = useState(initial || { name: '', description: '', color: '#3b82f6' });

  return (
    <Overlay onClose={onClose}>
      <ModalBox>
        <ModalHeader title={initial ? 'Edit Section' : 'New Section'} onClose={onClose} />
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-group">
            <label>Section Name *</label>
            <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Receipts, Contracts, Invoices…" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description…" />
          </div>
          <div className="form-group">
            <label>Colour</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {SECTION_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, opacity: form.color === c ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
          </div>

          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Section'}</button>
          </div>
        </form>
      </ModalBox>
    </Overlay>
  );
};

// ── Upload File Modal ──────────────────────────────────────────
const UploadModal = ({ sections, defaultSectionId, onUploaded, onClose }) => {
  const fileRef = useRef();
  const [file,      setFile]      = useState(null);
  const [sectionId, setSectionId] = useState(defaultSectionId || '');
  const [reference, setReference] = useState('');
  const [notes,     setNotes]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      await filesAPI.uploadFile(file, { section_id: sectionId || undefined, reference, notes, source_type: 'manual' });
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox>
        <ModalHeader title="Upload File" onClose={onClose} />

        {/* Drop zone */}
        <div
          style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 10, padding: 30, textAlign: 'center', marginBottom: 20, cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} style={{ color: '#94a3b8', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{file ? file.name : 'Click to select a file'}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Images, PDF, Word, Excel — up to 20 MB</div>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div className="form-group">
          <label>Section</label>
          <select className="form-control" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">— No section —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Reference #</label>
            <input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. RCP-001" />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional…" />
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!file || loading} onClick={handleUpload}>
            <Upload size={16} />{loading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </ModalBox>
    </Overlay>
  );
};

// ── Edit File Modal ────────────────────────────────────────────
const EditFileModal = ({ file, sections, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    name:       file.original_name || file.name,
    reference:  file.reference  || '',
    notes:      file.notes      || '',
    section_id: file.section_id?.toString() || '',
  });

  return (
    <Overlay onClose={onClose}>
      <ModalBox>
        <ModalHeader title="Edit File Details" onClose={onClose} />
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-group">
            <label>File Name</label>
            <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Section</label>
            <select className="form-control" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
              <option value="">— No section —</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Reference #</label>
              <input className="form-control" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. RCP-001" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </ModalBox>
    </Overlay>
  );
};

// ── File Preview Modal ─────────────────────────────────────────
const PreviewModal = ({ file, onClose }) => {
  const isImage = file.mime_type?.startsWith('image/');
  const isPdf   = file.mime_type === 'application/pdf';

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{file.original_name || file.name}</div>
            {file.reference && <div style={{ fontSize: 12, color: '#94a3b8' }}>Ref: {file.reference}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href={file.url} target="_blank" rel="noopener noreferrer" download className="btn btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>
              <Download size={14} /> Download
            </a>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, textAlign: 'center', background: '#f8fafc' }}>
          {isImage && (
            <img src={file.url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
          )}
          {isPdf && (
            <iframe src={file.url} title={file.name} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8 }} />
          )}
          {!isImage && !isPdf && (
            <div style={{ padding: '60px 20px' }}>
              <FileIcon mimeType={file.mime_type} size={48} />
              <div style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Preview not available for this file type.</div>
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
                <Download size={16} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
};

// ── Main Files Page ────────────────────────────────────────────
const Files = () => {
  const [sections,        setSections]        = useState([]);
  const [files,           setFiles]           = useState([]);
  const [selectedSection, setSelectedSection] = useState(null); // null = All Files
  const [search,          setSearch]          = useState('');
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingFiles,    setLoadingFiles]    = useState(false);

  // Modal state
  const [modal,           setModal]           = useState(null); // 'newSection'|'editSection'|'upload'|'editFile'|'preview'
  const [editSectionData, setEditSectionData] = useState(null);
  const [editFileData,    setEditFileData]    = useState(null);
  const [previewFile,     setPreviewFile]     = useState(null);
  const [savingSection,   setSavingSection]   = useState(false);
  const [savingFile,      setSavingFile]      = useState(false);
  const [sectionError,    setSectionError]    = useState('');

  const fetchSections = useCallback(async () => {
    try {
      const res = await filesAPI.getSections();
      setSections(res.data.sections);
    } catch (err) { console.error(err); }
    finally { setLoadingSections(false); }
  }, []);

  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const params = {};
      if (selectedSection) params.section_id = selectedSection.id;
      if (search)          params.search = search;
      const res = await filesAPI.getFiles(params);
      setFiles(res.data.files);
    } catch (err) { console.error(err); }
    finally { setLoadingFiles(false); }
  }, [selectedSection, search]);

  useEffect(() => { fetchSections(); }, [fetchSections]);
  useEffect(() => { fetchFiles(); },    [fetchFiles]);

  const handleCreateSection = async (form) => {
    setSectionError(''); setSavingSection(true);
    try {
      await filesAPI.createSection(form);
      await fetchSections();
      setModal(null);
    } catch (err) { setSectionError(err.response?.data?.message || 'Failed to create section'); }
    finally { setSavingSection(false); }
  };

  const handleEditSection = async (form) => {
    setSectionError(''); setSavingSection(true);
    try {
      await filesAPI.updateSection(editSectionData.id, form);
      await fetchSections();
      setModal(null);
    } catch (err) { setSectionError(err.response?.data?.message || 'Failed to update section'); }
    finally { setSavingSection(false); }
  };

  const handleDeleteSection = async (id) => {
    if (!window.confirm('Delete this section? Files inside will not be deleted.')) return;
    try {
      await filesAPI.deleteSection(id);
      if (selectedSection?.id === id) setSelectedSection(null);
      fetchSections();
    } catch (err) { console.error(err); }
  };

  const handleEditFile = async (form) => {
    setSavingFile(true);
    try {
      await filesAPI.updateFile(editFileData.id, form);
      await fetchFiles();
      await fetchSections();
      setModal(null);
    } catch (err) { console.error(err); }
    finally { setSavingFile(false); }
  };

  const handleDeleteFile = async (id) => {
    if (!window.confirm('Delete this file permanently?')) return;
    try {
      await filesAPI.deleteFile(id);
      fetchFiles();
      fetchSections();
    } catch (err) { console.error(err); }
  };

  const totalFiles = sections.reduce((sum, s) => sum + parseInt(s.file_count || 0), 0);

  const sourceLabel = (f) => {
    if (f.source_type === 'bank_transaction') return '🏦 Banking';
    return '📁 Manual upload';
  };

  return (
    <div className="page">
      <Header title="Files" subtitle="Store and organise documents, receipts, and proofs of transactions" />

      <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Sections ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>Sections</span>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => { setSectionError(''); setModal('newSection'); }}>
              <FolderPlus size={15} /> New
            </button>
          </div>

          {/* All Files */}
          <div
            onClick={() => setSelectedSection(null)}
            style={{
              background: '#fff', border: `2px solid ${!selectedSection ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Folder size={18} style={{ color: '#64748b' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>All Files</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{totalFiles} file{totalFiles !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {loadingSections ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: 16, fontSize: 13 }}>Loading…</div>
          ) : sections.length === 0 ? (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 20, textAlign: 'center' }}>
              <Folder size={28} style={{ color: '#cbd5e1', marginBottom: 8 }} />
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No sections yet.<br />Create one to organise your files.</div>
            </div>
          ) : (
            sections.map((sec) => (
              <div
                key={sec.id}
                onClick={() => setSelectedSection(sec)}
                style={{
                  background: '#fff', border: `2px solid ${selectedSection?.id === sec.id ? sec.color : '#e2e8f0'}`,
                  borderRadius: 10, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: sec.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Folder size={18} style={{ color: sec.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{sec.file_count} file{sec.file_count !== '1' ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn-icon" style={{ padding: 3 }} title="Edit" onClick={() => { setEditSectionData(sec); setSectionError(''); setModal('editSection'); }}>
                    <Edit2 size={13} />
                  </button>
                  <button className="btn-icon text-danger" style={{ padding: 3 }} title="Delete" onClick={() => handleDeleteSection(sec.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Right: Files ── */}
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedSection ? (
                  <>
                    <Folder size={20} style={{ color: selectedSection.color }} />
                    {selectedSection.name}
                  </>
                ) : 'All Files'}
              </div>
              {selectedSection?.description && (
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{selectedSection.description}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={fetchFiles} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button className="btn btn-primary" onClick={() => setModal('upload')}>
                <Upload size={16} /> Upload File
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Search by name, reference, or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Files table */}
          <div className="card">
            {loadingFiles ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading files…</div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Paperclip size={40} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                  {search ? 'No files match your search' : 'No files yet'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
                  {search ? 'Try a different search term' : 'Upload your first file using the button above'}
                </div>
                {!search && (
                  <button className="btn btn-primary" onClick={() => setModal('upload')}>
                    <Upload size={16} /> Upload File
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Reference #</th>
                      <th>Section</th>
                      <th>Source</th>
                      <th>Size</th>
                      <th>Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileIcon mimeType={f.mime_type} size={22} />
                            <div>
                              <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 14, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.original_name || f.name}
                              </div>
                              {f.notes && <div style={{ fontSize: 12, color: '#94a3b8' }}>{f.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {f.reference
                            ? <span style={{ fontFamily: 'monospace', fontSize: 13, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#334155' }}>{f.reference}</span>
                            : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
                        </td>
                        <td>
                          {f.section_name
                            ? (
                              <span style={{ background: (f.section_color || '#3b82f6') + '20', color: f.section_color || '#3b82f6', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                {f.section_name}
                              </span>
                            )
                            : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 13, color: '#64748b' }}>{sourceLabel(f)}</td>
                        <td style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtBytes(f.size_bytes)}</td>
                        <td style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(f.created_at)}</td>
                        <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn-icon" title="Preview" style={{ color: '#3b82f6' }} onClick={() => { setPreviewFile(f); setModal('preview'); }}>
                            <Eye size={15} />
                          </button>
                          <a href={f.url} target="_blank" rel="noopener noreferrer" download>
                            <button className="btn-icon" title="Download" style={{ color: '#64748b' }}>
                              <Download size={15} />
                            </button>
                          </a>
                          <button className="btn-icon" title="Edit" style={{ color: '#64748b' }} onClick={() => { setEditFileData(f); setModal('editFile'); }}>
                            <Edit2 size={15} />
                          </button>
                          <button className="btn-icon text-danger" title="Delete" onClick={() => handleDeleteFile(f.id)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 13, color: '#64748b' }}>
                  {files.length} file{files.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'newSection' && (
        <SectionModal onSave={handleCreateSection} onClose={() => setModal(null)} saving={savingSection} error={sectionError} />
      )}
      {modal === 'editSection' && editSectionData && (
        <SectionModal initial={editSectionData} onSave={handleEditSection} onClose={() => setModal(null)} saving={savingSection} error={sectionError} />
      )}
      {modal === 'upload' && (
        <UploadModal
          sections={sections}
          defaultSectionId={selectedSection?.id}
          onUploaded={() => { fetchFiles(); fetchSections(); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'editFile' && editFileData && (
        <EditFileModal file={editFileData} sections={sections} onSave={handleEditFile} onClose={() => setModal(null)} saving={savingFile} />
      )}
      {modal === 'preview' && previewFile && (
        <PreviewModal file={previewFile} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

export default Files;
