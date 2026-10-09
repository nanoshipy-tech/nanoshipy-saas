'use client';

import React, { useState, useEffect } from 'react';
import {
  UploadCloud, ImagePlus, Check, X, RotateCw, Sparkles,
  Link as LinkIcon, Tag, AlertCircle, Eye, ArrowRight, Loader2,
  CheckCircle2, Globe, FileImage, Power, Ban
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient, getPlatformAccessToken } from '@/lib/apiClient';

export interface PlatformBannerConfig {
  mode: 'image' | 'text' | 'disabled' | 'default';
  is_active?: boolean;
  imageUrl?: string;
  headline?: string;
  subtext?: string;
  badge?: string;
  code?: string;
  ctaText?: string;
  ctaLink?: string;
}

const PRESET_BANNERS = [
  {
    name: 'Diwali Festive Rush',
    headline: 'Diwali Super Express: Flat ₹32/500g Air Cargo Linehaul',
    subtext: 'Next-day regional air delivery + Free RTO Insurance protection up to ₹5,000.',
    badge: 'Diwali Special',
    code: 'DIWALI32',
    ctaText: 'Ship Diwali Orders',
    ctaLink: '/orders/new',
  },
  {
    name: 'Weekend Flash Freight',
    headline: 'Zero Platform Fee & Flat 20% Cashback on All Surface Dispatches',
    subtext: 'Applies to Delhivery, ST Courier, and Blue Dart consignments booked this weekend.',
    badge: 'Weekend Rush',
    code: 'WEEKEND20',
    ctaText: 'Book Consignments',
    ctaLink: '/orders/new',
  },
  {
    name: 'Zero-RTO Shield',
    headline: 'Nanoshipy Shield: 100% Protected COD Deliveries & WhatsApp NDR',
    subtext: 'Automated consignee WhatsApp location check-in reduces delivery failures by 34%.',
    badge: 'NDR Shield',
    code: 'SHIELD100',
    ctaText: 'Enable NDR AI',
    ctaLink: '/ndr',
  },
];

export default function AdminBannerSettingsPage() {
  // Master Enable / Disable Toggle
  const [bannerEnabled, setBannerEnabled] = useState(true);

  // Exclusive Banner Option (Image vs Text)
  const [bannerMode, setBannerMode] = useState<'upload' | 'text'>('upload');

  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [directImageUrl, setDirectImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Text announcement state
  const [headline, setHeadline] = useState('Flat 18% OFF on All Delhivery & ST Courier Air Shipments');
  const [subtext, setSubtext] = useState('Priority cargo linehaul dispatch + Free RTO Insurance protection up to ₹5,000 per consignment.');
  const [badge, setBadge] = useState('Seasonal Partner Discount');
  const [code, setCode] = useState('FESTIVE18');
  const [ctaText, setCtaText] = useState('Apply & Book');
  const [ctaLink, setCtaLink] = useState('/orders/new');

  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 1. Fetch live active banner from central backend API
    apiClient.get('/banners/active')
      .then((res) => {
        const data = res.data?.data;
        if (data && data.is_active !== false) {
          setBannerEnabled(true);
          if (data.mode === 'image' && data.image_url) {
            setBannerMode('upload');
            const fullUrl = data.image_url.startsWith('/')
              ? `https://api.nanoshipy.com${data.image_url}`
              : data.image_url;
            setImagePreview(fullUrl);
            setServerImageUrl(data.image_url);
          } else {
            setBannerMode('text');
          }
          if (data.headline) setHeadline(data.headline);
          if (data.subtext) setSubtext(data.subtext);
          if (data.badge) setBadge(data.badge);
          if (data.code) setCode(data.code);
          if (data.cta_text) setCtaText(data.cta_text);
          if (data.cta_link) setCtaLink(data.cta_link);
        } else {
          // Banners are currently deactivated
          setBannerEnabled(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load active banner from API:', err);
      });
  }, []);

  // Handle local file selection + automatic background upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Banner file must be under 10MB');
      return;
    }

    setSelectedFile(file);

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Trigger instant upload to backend
    await uploadFileToServer(file);
  };

  const uploadFileToServer = async (file: File) => {
    setUploadingImage(true);
    const toastId = toast.loading('Uploading banner image to server...');
    try {
      const formData = new FormData();
      formData.append('image', file);

      let uploadedUrl: string | null = null;
      try {
        const res = await apiClient.post('/banners/upload', formData);
        uploadedUrl = res.data?.data?.url || null;
      } catch (axiosErr) {
        console.warn('Axios upload failed, trying native fetch fallback...', axiosErr);
        const token = getPlatformAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const fetchRes = await fetch('https://api.nanoshipy.com/api/v1/banners/upload', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData,
        });
        const fetchData = await fetchRes.json();
        if (fetchData?.data?.url) {
          uploadedUrl = fetchData.data.url;
        } else {
          throw new Error(fetchData?.error?.message || 'Server upload failed');
        }
      }

      if (uploadedUrl) {
        setServerImageUrl(uploadedUrl);
        setImagePreview(`https://api.nanoshipy.com${uploadedUrl}`);
        toast.success('✓ Banner image uploaded successfully!', { id: toastId });
        return uploadedUrl;
      } else {
        toast.error('Upload succeeded but no image URL was returned', { id: toastId });
        return null;
      }
    } catch (err: any) {
      console.error('Banner upload error:', err);
      const msg = err.response?.data?.error?.message || err.message || 'Failed to upload image file to server';
      toast.error(msg, { id: toastId });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleToggleDisable = async () => {
    setBannerEnabled(false);
    try {
      await apiClient.post('/banners', { is_active: false, mode: 'text' });
      try {
        localStorage.removeItem('nanoshipy_platform_banner');
        localStorage.removeItem('nanoshipy_seller_custom_banner');
      } catch (e) {}
      toast.success('✓ Banner Disabled! Hidden from all seller dashboards.');
    } catch (err) {
      console.warn('Banner disable error:', err);
    }
  };

  const handleToggleEnable = () => {
    setBannerEnabled(true);
    toast('Banner Enabled! Select Option 1 or Option 2 and click Publish.', { icon: '✨' });
  };

  const handlePublishBanner = async () => {
    setIsSubmitting(true);
    try {
      if (!bannerEnabled) {
        // Deactivate all banners on the platform
        const payload = {
          mode: 'text',
          is_active: false,
        };

        try {
          await apiClient.post('/banners', payload);
        } catch (axiosErr) {
          const token = getPlatformAccessToken();
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          await fetch('https://api.nanoshipy.com/api/v1/banners', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload),
          });
        }

        try {
          localStorage.removeItem('nanoshipy_platform_banner');
          localStorage.removeItem('nanoshipy_seller_custom_banner');
        } catch (e) {}

        setIsSaved(true);
        toast.success('✓ Banner Disabled! No banner will appear on seller dashboards.');
        setTimeout(() => setIsSaved(false), 3000);
        return;
      }

      // If enabled, publish the single selected option
      let finalImageUrl: string | null = null;

      if (bannerMode === 'upload') {
        if (imageTab === 'url') {
          if (!directImageUrl.trim()) {
            toast.error('Please enter an image URL');
            setIsSubmitting(false);
            return;
          }
          finalImageUrl = directImageUrl.trim();
        } else {
          // Upload tab
          if (serverImageUrl) {
            finalImageUrl = serverImageUrl;
          } else if (selectedFile) {
            const uploaded = await uploadFileToServer(selectedFile);
            if (!uploaded) {
              setIsSubmitting(false);
              return;
            }
            finalImageUrl = uploaded;
          } else if (imagePreview && !imagePreview.startsWith('data:')) {
            finalImageUrl = imagePreview;
          }

          if (!finalImageUrl) {
            toast.error('Please upload an image file or provide an image link');
            setIsSubmitting(false);
            return;
          }

          if (finalImageUrl && finalImageUrl.startsWith('https://api.nanoshipy.com/')) {
            finalImageUrl = finalImageUrl.replace('https://api.nanoshipy.com', '');
          }
        }
      }

      const payload = {
        mode: bannerMode === 'upload' ? 'image' : 'text',
        image_url: bannerMode === 'upload' ? finalImageUrl : null,
        headline: headline || 'Special Promotional Announcement',
        subtext: subtext || 'Exclusive freight offers and priority shipping available now.',
        badge: badge || 'Special Offer',
        code: code || 'PROMO10',
        cta_text: ctaText || 'Apply & Book',
        cta_link: ctaLink || '/orders/new',
        is_active: true,
      };

      // Save directly to central PostgreSQL database via Backend API with fetch fallback
      try {
        await apiClient.post('/banners', payload);
      } catch (axiosErr) {
        console.warn('Axios banner save failed, trying native fetch fallback...', axiosErr);
        const token = getPlatformAccessToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const fetchRes = await fetch('https://api.nanoshipy.com/api/v1/banners', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const fetchData = await fetchRes.json();
        if (!fetchData?.success) {
          throw new Error(fetchData?.error?.message || 'Failed to save banner');
        }
      }

      // Local storage fallback for seamless client caching
      try {
        localStorage.setItem('nanoshipy_platform_banner', JSON.stringify(payload));
        localStorage.setItem('nanoshipy_seller_custom_banner', JSON.stringify(payload));
      } catch (e) {}

      setIsSaved(true);
      toast.success(`🎉 ${bannerMode === 'upload' ? 'Image Banner' : 'Text Offer Card'} published live to seller dashboards!`);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      console.error('Banner publish error:', err);
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to save banner to backend');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDefault = async () => {
    setIsSubmitting(true);
    try {
      const def = {
        mode: 'text',
        image_url: null,
        headline: 'Flat 18% OFF on All Delhivery & ST Courier Air Shipments',
        subtext: 'Priority cargo linehaul dispatch + Free RTO Insurance protection up to ₹5,000 per consignment.',
        badge: 'Seasonal Partner Discount',
        code: 'FESTIVE18',
        cta_text: 'Apply & Book',
        cta_link: '/orders/new',
        is_active: true,
      };

      await apiClient.post('/banners', def);

      try {
        localStorage.setItem('nanoshipy_platform_banner', JSON.stringify(def));
        localStorage.setItem('nanoshipy_seller_custom_banner', JSON.stringify(def));
      } catch (e) {}

      setBannerEnabled(true);
      setImagePreview(null);
      setServerImageUrl(null);
      setSelectedFile(null);
      setDirectImageUrl('');
      setBannerMode('text');
      setHeadline(def.headline);
      setSubtext(def.subtext);
      setBadge(def.badge);
      setCode(def.code);
      setCtaText(def.cta_text);
      setCtaLink(def.cta_link);
      toast.success('Reset to official Nanoshipy default banner on live server');
    } catch (err: any) {
      toast.error('Failed to reset banner on server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5B069A]/15 border border-[#8410DC]/30 flex items-center justify-center text-[#8410DC] shrink-0">
            <ImagePlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#14121F]">Seller Dashboard Banner Studio</h1>
            <p className="text-xs text-[#534F66] mt-0.5">
              Control the single active promotional banner or announcement shown live on seller dashboards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefault}
            disabled={isSubmitting || uploadingImage}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white border border-slate-200 rounded-xl hover:bg-rose-50 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={handlePublishBanner}
            disabled={isSubmitting || uploadingImage}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
              !bannerEnabled
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Saved Live!</span>
              </>
            ) : !bannerEnabled ? (
              <>
                <Ban className="w-3.5 h-3.5" />
                <span>Save (Disable Banner)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Publish to User Panel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================= 1. MASTER BANNER VISIBILITY TOGGLE ================= */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">User Panel Banner Status</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              bannerEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {bannerEnabled ? '● Currently Enabled' : '○ Currently Disabled'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {bannerEnabled
              ? 'Active: One selected banner option is displayed to sellers on their dashboard.'
              : 'Disabled: No banner will be displayed to sellers on their dashboard.'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToggleEnable}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              bannerEnabled
                ? 'bg-[#5B069A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Enable</span>
          </button>
          <button
            type="button"
            onClick={handleToggleDisable}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              !bannerEnabled
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Disable</span>
          </button>
        </div>
      </div>

      {/* ================= 2. BANNER OPTION SELECTOR (ONE OPTION AT A TIME) ================= */}
      {bannerEnabled ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Active Banner Type (1 Option Live at a Time)
              </span>
              <span className="text-[11px] text-[#5B069A] font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                Single Active Option Mode
              </span>
            </div>

            <div className="bg-white p-2 rounded-2xl border border-[#E8DEF2] shadow-xs flex gap-2">
              <button
                type="button"
                onClick={() => setBannerMode('upload')}
                className={`flex-1 py-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                  bannerMode === 'upload'
                    ? 'bg-[#5B069A] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Option 1: Image Banner (Full-Width Responsive)</span>
              </button>
              <button
                type="button"
                onClick={() => setBannerMode('text')}
                className={`flex-1 py-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                  bannerMode === 'text'
                    ? 'bg-[#5B069A] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Option 2: Interactive Text Offer Card (Code + Countdown)</span>
              </button>
            </div>
          </div>

          {/* ================= OPTION 1: IMAGE BANNER CONFIG ================= */}
          {bannerMode === 'upload' && (
            <div className="bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Banner Image Source</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Upload a high-resolution image or provide an image link.</p>
                </div>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setImageTab('upload')}
                    className={`px-3 py-1 rounded-lg transition ${imageTab === 'upload' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab('url')}
                    className={`px-3 py-1 rounded-lg transition ${imageTab === 'url' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {imageTab === 'upload' ? (
                <div className="space-y-3">
                  <label htmlFor="admin-banner-file" className="border-2 border-dashed border-[#D6A8FF] hover:border-[#8410DC] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-purple-50/20 hover:bg-purple-50/40 block">
                    <input
                      id="admin-banner-file"
                      name="banner_file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8DEF2] flex items-center justify-center text-[#8410DC] shadow-sm mb-3 mx-auto">
                      {uploadingImage ? (
                        <Loader2 className="w-7 h-7 animate-spin text-[#8410DC]" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      <span className="text-[#8410DC]">{uploadingImage ? 'Uploading image to server...' : 'Click to choose image'}</span> or drag banner file here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Recommended size: 1200×260 or 4:1 ratio (PNG, JPG, WEBP max 10MB)
                    </p>
                  </label>

                  {/* Status of uploaded file */}
                  {serverImageUrl && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold">Uploaded to Server:</span>
                        <span className="font-mono text-emerald-700 truncate">{serverImageUrl}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-200/60 text-emerald-900 font-bold text-[10px] uppercase">
                        Ready
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="admin-banner-direct-url" className="text-xs font-bold text-slate-700 block">External Image URL</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="admin-banner-direct-url"
                        name="direct_image_url"
                        type="url"
                        value={directImageUrl}
                        onChange={(e) => {
                          setDirectImageUrl(e.target.value);
                          if (e.target.value.trim()) {
                            setImagePreview(e.target.value.trim());
                          }
                        }}
                        placeholder="https://images.unsplash.com/... or https://your-cdn.com/banner.png"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-[#8410DC] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (directImageUrl.trim()) {
                          setImagePreview(directImageUrl.trim());
                          toast.success('Image URL attached');
                        }
                      }}
                      className="px-4 py-2 bg-[#5B069A] text-white text-xs font-semibold rounded-xl hover:bg-[#8410DC] transition cursor-pointer"
                    >
                      Attach
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#5B069A]" />
                      <span>Banner Image Preview:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setServerImageUrl(null);
                        setSelectedFile(null);
                        setDirectImageUrl('');
                      }}
                      className="text-xs text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove Image</span>
                    </button>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden border border-[#E8DEF2] h-40 sm:h-48 bg-slate-900 shadow-inner group">
                    <img
                      src={imagePreview.startsWith('/') ? `https://api.nanoshipy.com${imagePreview}` : imagePreview}
                      alt="Banner preview"
                      className="w-full h-full object-cover group-hover:scale-101 transition duration-300"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="admin-banner-cta-link" className="text-xs font-bold text-slate-700 block mb-1">Click Action URL / Destination Route</label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-banner-cta-link"
                    name="cta_link"
                    type="text"
                    value={ctaLink}
                    onChange={(e) => setCtaLink(e.target.value)}
                    placeholder="/orders/new or /wallet"
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:border-[#8410DC] outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Where sellers are redirected when clicking on the banner.</p>
              </div>

              {/* Bottom Primary Save Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handlePublishBanner}
                  disabled={isSubmitting || uploadingImage}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing Image Banner...</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Saved &amp; Published Live!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Publish Image Banner Live</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ================= OPTION 2: INTERACTIVE TEXT OFFER CARD CONFIG ================= */}
          {bannerMode === 'text' && (
            <div className="bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-xs space-y-5">
              <div>
                <label htmlFor="admin-banner-headline" className="text-xs font-bold text-slate-700 block mb-1">Offer Headline</label>
                <input
                  id="admin-banner-headline"
                  name="headline"
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Diwali Super Express: Flat ₹32/500g Air Cargo Linehaul"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:border-[#8410DC] outline-none"
                />
              </div>

              <div>
                <label htmlFor="admin-banner-subtext" className="text-xs font-bold text-slate-700 block mb-1">Offer Subtext &amp; Terms</label>
                <textarea
                  id="admin-banner-subtext"
                  name="subtext"
                  rows={2}
                  value={subtext}
                  onChange={(e) => setSubtext(e.target.value)}
                  placeholder="e.g. Priority cargo linehaul dispatch + Free RTO Insurance protection."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:border-[#8410DC] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="admin-banner-badge" className="text-xs font-bold text-slate-700 block mb-1">Badge Tag</label>
                  <input
                    id="admin-banner-badge"
                    name="badge"
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="e.g. Festive Discount"
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:border-[#8410DC] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="admin-banner-code" className="text-xs font-bold text-slate-700 block mb-1">Coupon Code</label>
                  <input
                    id="admin-banner-code"
                    name="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. FESTIVE18"
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs font-mono uppercase text-slate-900 focus:border-[#8410DC] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="admin-banner-cta-text" className="text-xs font-bold text-slate-700 block mb-1">CTA Button Text</label>
                  <input
                    id="admin-banner-cta-text"
                    name="cta_text"
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Apply & Book"
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:border-[#8410DC] outline-none"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-3 border-t border-[#F2ECF7]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Select Preset Announcement:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {PRESET_BANNERS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setHeadline(p.headline);
                        setSubtext(p.subtext);
                        setBadge(p.badge);
                        setCode(p.code);
                        setCtaText(p.ctaText);
                        setCtaLink(p.ctaLink);
                        toast.success(`Loaded preset: ${p.name}`);
                      }}
                      className="p-3 rounded-xl border border-slate-200 hover:border-[#8410DC] bg-slate-50/50 hover:bg-purple-50/40 text-left transition cursor-pointer"
                    >
                      <p className="text-xs font-bold text-[#14121F] truncate">{p.name}</p>
                      <p className="text-[10px] text-[#5B069A] font-mono mt-0.5">{p.code}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Primary Save Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handlePublishBanner}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing Text Offer...</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Saved &amp; Published Live!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Publish Text Offer Live</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ================= LIVE PREVIEW CARD ================= */}
          <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-xs space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#5B069A]" /> Live Preview on Seller Workspace ({bannerMode === 'upload' ? 'Image Banner' : 'Text Offer Card'})
            </span>
            {bannerMode === 'upload' && imagePreview ? (
              <div className="rounded-2xl overflow-hidden border border-[#E8DEF2] shadow-xs group relative bg-slate-900">
                <div className="block w-full h-36 sm:h-44 md:h-52 overflow-hidden">
                  <img
                    src={imagePreview.startsWith('/') ? `https://api.nanoshipy.com${imagePreview}` : imagePreview}
                    alt="Promotional Banner Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white border border-[#E8DEF2] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-[#8410DC]">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B069A] bg-purple-50 px-2 py-0.5 rounded-full border border-[#E8DEF2]">
                    {badge}
                  </span>
                  <h3 className="text-sm font-bold text-[#14121F] mt-1">{headline}</h3>
                  <p className="text-xs text-slate-500">{subtext}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {code && (
                    <span className="text-xs font-mono font-bold text-[#5B069A] bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                      {code}
                    </span>
                  )}
                  <span className="px-3.5 py-1.5 rounded-lg text-white font-bold text-xs bg-gradient-to-r from-[#5B069A] to-[#8410DC]">
                    {ctaText}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ================= DISABLED BANNER STATE ================= */
        <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Ban className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">User Panel Promotional Banner is Disabled</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            All seller dashboards will display a clean layout without any promotional banners or image placeholders.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handlePublishBanner}
              disabled={isSubmitting}
              className="px-6 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save &amp; Confirm Disabled State</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
