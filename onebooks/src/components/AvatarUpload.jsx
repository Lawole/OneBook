import React, { useState, useRef } from 'react';
import { Camera, Loader } from 'lucide-react';
import api from '../services/api';

/**
 * AvatarUpload — click the avatar to pick a new image and upload it.
 *
 * Props:
 *  currentUrl  — existing avatar URL (or null)
 *  initials    — fallback text (e.g. "JD")
 *  bgColor     — fallback background color
 *  type        — 'company' | 'customer' | 'vendor'
 *  entityId    — ID of the customer/vendor (undefined for company)
 *  size        — circle diameter in px (default 72)
 *  onUploaded  — callback(newUrl: string)
 */
const AvatarUpload = ({ currentUrl, initials = '?', bgColor = '#3b82f6', type, entityId, size = 72, onUploaded }) => {
  const [url, setUrl] = useState(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimistic preview
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('type', type);
      if (entityId) formData.append('id', entityId);

      const res = await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUrl(res.data.url);
      if (onUploaded) onUploaded(res.data.url);
    } catch (err) {
      console.error('Avatar upload failed:', err);
      // Revert to original on failure
      setUrl(currentUrl || null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(preview);
      // Allow re-selecting the same file
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      className="avatar-upload"
      style={{ width: size, height: size }}
      onClick={() => !uploading && inputRef.current?.click()}
      title="Click to change photo"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Image or initials */}
      <div
        className="avatar-upload-face"
        style={{
          width: size,
          height: size,
          background: url ? 'transparent' : bgColor,
          fontSize: size * 0.3,
        }}
      >
        {url
          ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: '#fff', fontWeight: 700 }}>{initials}</span>
        }
      </div>

      {/* Upload overlay */}
      {uploading && (
        <div className="avatar-upload-overlay">
          <Loader size={size * 0.28} className="spin" />
        </div>
      )}

      {/* Camera badge */}
      {!uploading && (
        <div className="avatar-upload-badge">
          <Camera size={12} />
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
