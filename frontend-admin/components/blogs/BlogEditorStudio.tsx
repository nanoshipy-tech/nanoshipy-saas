'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, UploadCloud, Eye, ImagePlus, Check, X,
  Clock, Calendar, Globe, Sparkles, Tag, HelpCircle,
  Heading1, Heading2, Heading3, Bold, Italic, List,
  ListOrdered, Quote, Code, Link as LinkIcon, Save,
  CheckCircle2, AlertCircle, FileText, Plus, Trash2
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

interface BlogEditorProps {
  initialId?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

const CATEGORIES = [
  'NDR & RTO',
  'Carrier Comparison',
  'E-commerce Growth',
  'Logistics & Shipping',
  'Platform Updates',
  'Industry News',
];

export function BlogEditorStudio({ initialId }: BlogEditorProps) {
  const router = useRouter();
  const isEditing = Boolean(initialId);

  const [title, setTitle] = useState('');
  const [h1Title, setH1Title] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [category, setCategory] = useState('Logistics & Shipping');
  const [tags, setTags] = useState<string[]>(['E-commerce', 'Shipping']);
  const [tagInput, setTagInput] = useState('');
  const [authorName, setAuthorName] = useState('NanoShipy Editorial');
  const [authorAvatar, setAuthorAvatar] = useState('');
  const [readingTime, setReadingTime] = useState('5 min read');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [publishedAt, setPublishedAt] = useState('');

  // Featured image
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Studio tabs
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Auto-slugify
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (autoSlug && !isEditing) {
      setSlug(slugify(val));
    }
  };

  // Auto-calculate reading time based on content words
  useEffect(() => {
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    setReadingTime(`${minutes} min read`);
  }, [content]);

  // Load existing post if editing
  useEffect(() => {
    if (!initialId) return;
    apiClient.get(`/blogs/admin/detail/${initialId}`)
      .then((res) => {
        const post = res.data?.data;
        if (post) {
          setTitle(post.title || '');
          setH1Title(post.h1_title || '');
          setSlug(post.slug || '');
          setAutoSlug(false);
          setExcerpt(post.excerpt || '');
          setContent(post.content || '');
          setFaqItems(Array.isArray(post.faq_items) ? post.faq_items : []);
          setCategory(post.category || 'Logistics & Shipping');
          setTags(Array.isArray(post.tags) ? post.tags : []);
          setAuthorName(post.author_name || 'NanoShipy Editorial');
          setAuthorAvatar(post.author_avatar || '');
          setReadingTime(post.reading_time || '5 min read');
          setStatus(post.status === 'draft' ? 'draft' : 'published');
          setMetaTitle(post.meta_title || '');
          setMetaDescription(post.meta_description || '');
          setFeaturedImage(post.featured_image || null);
          if (post.published_at) {
            setPublishedAt(new Date(post.published_at).toISOString().split('T')[0]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load article:', err);
        toast.error('Failed to load article details');
      })
      .finally(() => setLoading(false));
  }, [initialId]);

  // Handle Tag Addition
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^,|,$/g, '');
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // FAQ Schema Item Handlers
  const handleAddFaqItem = () => {
    setFaqItems([...faqItems, { question: '', answer: '' }]);
  };

  const handleUpdateFaqItem = (index: number, field: 'question' | 'answer', val: string) => {
    const updated = [...faqItems];
    updated[index] = { ...updated[index], [field]: val };
    setFaqItems(updated);
  };

  const handleRemoveFaqItem = (index: number) => {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  };

  // Image upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error('Image must be under 8MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setFeaturedImage(reader.result as string);
        toast.success('Image loaded into preview');
      };
      reader.readAsDataURL(file);
    }
  };

  // Markdown Formatting Toolbar Buttons
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('blog-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selText = content.substring(start, end) || 'text';
    const replacement = `${prefix}${selText}${suffix}`;
    const nextContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(nextContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selText.length);
    }, 50);
  };

  // Save / Publish
  const handleSave = async (overrideStatus?: 'published' | 'draft') => {
    if (!title.trim()) {
      toast.error('Please enter an article title');
      return;
    }
    if (!content.trim()) {
      toast.error('Please write article content');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = featuredImage;

      // Upload image to backend if a new local file was selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);
        const upRes = await apiClient.post('/blogs/upload-image', formData);
        if (upRes.data?.data?.url) {
          finalImageUrl = upRes.data.data.url;
        }
      }

      const finalStatus = overrideStatus || status;
      const validFaqItems = faqItems
        .filter(item => item.question && item.question.trim())
        .map(item => ({ question: item.question.trim(), answer: (item.answer || '').trim() }));

      const payload = {
        title: title.trim(),
        h1_title: h1Title.trim() || null,
        slug: slug.trim() || slugify(title),
        excerpt: excerpt.trim() || title.trim(),
        content: content.trim(),
        faq_items: validFaqItems,
        featured_image: finalImageUrl,
        category: category.trim(),
        tags,
        author_name: authorName.trim() || 'NanoShipy Editorial',
        author_avatar: authorAvatar.trim() || null,
        reading_time: readingTime,
        status: finalStatus,
        meta_title: metaTitle.trim() || title.trim(),
        meta_description: metaDescription.trim() || excerpt.trim() || title.trim(),
        published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      };

      if (isEditing) {
        await apiClient.put(`/blogs/${initialId}`, payload);
        toast.success(`Article updated and ${finalStatus === 'published' ? 'published live' : 'saved as draft'}!`);
      } else {
        const res = await apiClient.post('/blogs', payload);
        toast.success(`Article successfully ${finalStatus === 'published' ? 'published live' : 'saved as draft'}!`);
      }

      router.push('/blogs');
    } catch (err: any) {
      console.error('Save blog error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to save blog post');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
        <div className="w-7 h-7 border-2 border-purple-300 border-t-[#5B069A] rounded-full animate-spin" />
        <span>Loading article editor…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/blogs"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Back to blog articles list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isEditing ? 'Edit Blog Article' : 'Write New Blog Article'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft or publish to the public <strong className="text-[#5B069A]">nanoshipy.com/blog</strong> engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #5B069A 0%, #8410DC 100%)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{saving ? 'Publishing…' : 'Publish Live'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Main Content Column (Col 8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Article Title & Auto-Slug Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Article Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. 7 Proven Tactics to Reduce E-commerce RTO by 35% in 2026"
                className="w-full px-4 py-2.5 text-base sm:text-lg font-bold text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none transition"
              />
            </div>

            {/* Slug row */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">nanoshipy.com/blog/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setAutoSlug(false); }}
                placeholder="url-slug"
                className="flex-1 px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-[#8410DC]"
              />
              <button
                type="button"
                onClick={() => { setAutoSlug(true); setSlug(slugify(title)); }}
                className="text-[11px] text-[#5B069A] hover:underline font-semibold"
              >
                Auto-generate
              </button>
            </div>

            {/* Page H1 Tag (SEO Structure Override) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Heading1 className="w-3.5 h-3.5 text-[#5B069A]" />
                  <span>Page H1 Tag (SEO Override)</span>
                  <span className="text-[10px] font-normal text-slate-500 lowercase bg-slate-100 px-1.5 py-0.5 rounded">optional</span>
                </label>
                <span className="text-[11px] text-slate-400">Defaults to Article Title if left empty</span>
              </div>
              <input
                type="text"
                value={h1Title}
                onChange={(e) => setH1Title(e.target.value)}
                placeholder={title ? `Leave empty to use: "${title}"` : "e.g. Complete 2026 Guide to Minimizing E-commerce NDR Rates"}
                className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none transition"
              />
            </div>

            {/* Excerpt / Summary */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Short Excerpt / Preview Summary
              </label>
              <textarea
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A compelling 1-2 sentence hook displayed on social cards and the blog directory feed..."
                className="w-full px-3 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none transition"
              />
            </div>
          </div>

          {/* Featured Image Studio */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Featured Hero Image</h3>
                <p className="text-xs text-slate-500 mt-0.5">Displayed at the top of the article and on Google cards.</p>
              </div>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setImageTab('upload')}
                  className={`px-3 py-1 rounded-md transition ${imageTab === 'upload' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('url')}
                  className={`px-3 py-1 rounded-md transition ${imageTab === 'url' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {imageTab === 'upload' ? (
              <label className="border-2 border-dashed border-slate-200 hover:border-[#8410DC] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-purple-50/20 hover:bg-purple-50/40 block">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#8410DC] shadow-2xs mb-2 mx-auto">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  <span className="text-[#8410DC]">Click to upload</span> or drag and drop featured image
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  16:9 Aspect Ratio Recommended (Max 8MB: PNG, JPG, WEBP)
                </p>
              </label>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/... or direct image link"
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (imageUrlInput.trim()) {
                      setFeaturedImage(imageUrlInput.trim());
                      toast.success('Image URL attached');
                    }
                  }}
                  className="px-4 py-2 bg-[#5B069A] text-white text-xs font-semibold rounded-xl"
                >
                  Attach
                </button>
              </div>
            )}

            {/* Image Preview */}
            {featuredImage && (
              <div className="relative rounded-xl border border-slate-200 overflow-hidden h-48 bg-slate-900 group">
                <img
                  src={featuredImage.startsWith('/') ? `https://api.nanoshipy.com${featuredImage}` : featuredImage}
                  alt="Featured banner preview"
                  className="w-full h-full object-cover group-hover:scale-101 transition duration-300"
                />
                <button
                  type="button"
                  onClick={() => { setFeaturedImage(null); setSelectedFile(null); setImageUrlInput(''); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Rich Content Editor Studio */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
            {/* Editor Toolbar Header */}
            <div className="p-3 bg-[#FAF9FC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditorTab('write')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'write' ? 'bg-white text-[#5B069A] shadow-2xs border border-purple-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Write Content
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${editorTab === 'preview' ? 'bg-white text-[#5B069A] shadow-2xs border border-purple-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Live Preview</span>
                </button>
              </div>

              {/* Formatting Quick Buttons */}
              {editorTab === 'write' && (
                <div className="flex items-center gap-1 text-slate-600">
                  <button type="button" onClick={() => insertFormatting('## ', '\n')} className="p-1.5 rounded hover:bg-slate-200" title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('### ', '\n')} className="p-1.5 rounded hover:bg-slate-200" title="Heading 3"><Heading3 className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('**', '**')} className="p-1.5 rounded hover:bg-slate-200" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('*', '*')} className="p-1.5 rounded hover:bg-slate-200" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('- ', '\n')} className="p-1.5 rounded hover:bg-slate-200" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('1. ', '\n')} className="p-1.5 rounded hover:bg-slate-200" title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('> ', '\n')} className="p-1.5 rounded hover:bg-slate-200" title="Quote"><Quote className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('```\n', '\n```')} className="p-1.5 rounded hover:bg-slate-200" title="Code Block"><Code className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => insertFormatting('[', '](https://...)')} className="p-1.5 rounded hover:bg-slate-200" title="Link"><LinkIcon className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {readingTime}
              </span>
            </div>

            {/* Textarea or Preview */}
            {editorTab === 'write' ? (
              <textarea
                id="blog-editor-textarea"
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your article in Markdown or plain text. Use ## for section headings, - for bullet lists, **bold** for emphasis, etc."
                className="w-full p-4 text-xs font-mono sm:text-sm text-slate-800 bg-white outline-none resize-y leading-relaxed"
              />
            ) : (
              <div className="p-6 prose prose-purple max-w-none text-xs sm:text-sm text-slate-800 min-h-[300px]">
                {content ? (
                  <div className="space-y-3 whitespace-pre-wrap font-sans">
                    {content}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No content written yet. Switch back to write mode.</p>
                )}
              </div>
            )}
          </div>

          {/* SEO & SERP Snippet Preview */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#5B069A]" />
                <span>Search Engine Optimization (SEO) & Google Card Preview</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Customize how this post appears on Google Search and social sharing.</p>
            </div>

            {/* Google SERP Live Simulation Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500 font-mono truncate">
                https://nanoshipy.com › blog › {slug || 'article-slug'}
              </div>
              <div className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer truncate">
                {metaTitle || title || 'Article Title - NanoShipy Logistics Blog'}
              </div>
              <div className="text-xs text-slate-600 line-clamp-2">
                {metaDescription || excerpt || 'Read this in-depth guide on the NanoShipy platform to optimize shipping and cut delivery times.'}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Title Tag</label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={title || 'Custom SEO Title'}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Description</label>
                <textarea
                  rows={2}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={excerpt || 'Meta description for search engine crawlers'}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Interactive FAQ Schema Builder Module */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#5B069A]" />
                  <h3 className="text-sm font-bold text-slate-900">FAQ Schema Builder (Google FAQPage JSON-LD)</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adds structured Q&amp;A rich snippets for Google Search and an interactive accordion on the article page.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddFaqItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-[#5B069A] border border-purple-200 hover:bg-purple-100 text-xs font-semibold transition cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            {faqItems.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No FAQ items added yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                  Click "Add Question" above to include structured frequently asked questions for SEO ranking.
                </p>
                <button
                  type="button"
                  onClick={handleAddFaqItem}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:border-[#8410DC] text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  + Add First FAQ
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {faqItems.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#5B069A] uppercase tracking-wider">
                        FAQ #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaqItem(idx)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.question}
                        onChange={(e) => handleUpdateFaqItem(idx, 'question', e.target.value)}
                        placeholder="Question (e.g. How does automated NDR reduce courier return losses?)"
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:border-[#8410DC] outline-none"
                      />
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={item.answer}
                        onChange={(e) => handleUpdateFaqItem(idx, 'answer', e.target.value)}
                        placeholder="Clear, authoritative answer that search engines and buyers can read..."
                        className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-[#8410DC] outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar Settings Column (Col 4) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Publishing Controls Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Publishing Settings
            </h3>

            {/* Status toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Visibility Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('published')}
                  className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                    status === 'published'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Published</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('draft')}
                  className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                    status === 'draft'
                      ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Draft</span>
                </button>
              </div>
            </div>

            {/* Published Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Publication Date</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
              />
            </div>

            {/* Estimated Reading Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reading Time Badge</label>
              <input
                type="text"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                placeholder="5 min read"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
              />
            </div>
          </div>

          {/* Categorization & Taxonomy Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Taxonomy & Categorization
            </h3>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Article Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none cursor-pointer"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Tags Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Article Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-[#5B069A] border border-purple-200"
                  >
                    <span>{t}</span>
                    <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-rose-600">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag and press Enter..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
              />
            </div>
          </div>

          {/* Author Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Author Details
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Author Name</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Karthik Ramanathan"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Avatar Image URL (Optional)</label>
              <input
                type="text"
                value={authorAvatar}
                onChange={(e) => setAuthorAvatar(e.target.value)}
                placeholder="https://.../avatar.jpg"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none"
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
