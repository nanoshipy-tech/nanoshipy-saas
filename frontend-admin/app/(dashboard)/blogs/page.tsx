'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText, Plus, Search, ExternalLink, Edit3, Trash2,
  Eye, Calendar, Clock, Tag, RefreshCw, AlertCircle, CheckCircle2,
  Sparkles, BookOpen, Layers
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string;
  category: string;
  tags?: string[];
  author_name: string;
  reading_time?: string;
  status: 'published' | 'draft' | 'archived';
  views_count: number;
  published_at: string;
  created_at: string;
}

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/blogs/admin/list', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search.trim() || undefined,
        },
      });
      setBlogs(res.data?.data?.items || []);
    } catch (err: any) {
      console.error('Failed to load blogs:', err);
      toast.error('Failed to load blog posts from API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBlogs();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete article:\n"${title}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await apiClient.delete(`/blogs/${id}`);
      toast.success('Article deleted successfully');
      setBlogs(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      console.error('Failed to delete blog:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to delete article');
    } finally {
      setDeletingId(null);
    }
  };

  const publishedCount = blogs.filter(b => b.status === 'published').length;
  const totalViews = blogs.reduce((acc, b) => acc + (b.views_count || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B069A] bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              Content Management
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#14121F] tracking-tight mt-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#5B069A]" />
            <span>Blog Posts Studio</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Author, curate, and publish industry articles and freight advisories to the public <strong className="text-slate-700">nanoshipy.com/blog</strong> engine.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchBlogs}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh articles"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="https://nanoshipy.com/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 text-slate-700 hover:text-[#5B069A] font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Public Blog</span>
          </a>
          <Link
            href="/blogs/new"
            className="px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-sm hover:shadow-md transition flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #5B069A 0%, #8410DC 100%)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Write Article</span>
          </Link>
        </div>
      </div>

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Total Articles</p>
          <div className="text-2xl font-bold text-slate-900 mt-1">{blogs.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">In catalog</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Published Live</p>
          <div className="text-2xl font-bold text-slate-900 mt-1">{publishedCount}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Visible on nanoshipy.com</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide">Total Reads</p>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalViews}</div>
          <p className="text-[11px] text-purple-600 mt-0.5 font-medium">Cumulative impressions</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Public Engine</p>
          <div className="text-xs font-mono font-bold text-slate-800 mt-2 bg-slate-50 px-2 py-1 rounded border border-slate-200 w-fit truncate">
            /api/v1/blogs
          </div>
          <p className="text-[11px] text-slate-500 mt-1">REST API Sync Active</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['all', 'published', 'draft'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#5B069A] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'all' ? 'All Articles' : st}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, category..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8410DC] outline-none transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      {/* Articles Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-purple-300 border-t-[#5B069A] rounded-full animate-spin" />
            <span>Loading articles from database…</span>
          </div>
        ) : blogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <BookOpen className="w-10 h-10 text-slate-300" />
            <div>
              <p className="text-sm font-bold text-slate-800">No blog posts found</p>
              <p className="text-xs text-slate-500 mt-0.5">Click Write Article to author your first logistics advisory.</p>
            </div>
            <Link
              href="/blogs/new"
              className="px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-2xs hover:shadow-md transition mt-1"
              style={{ background: 'linear-gradient(135deg, #5B069A 0%, #8410DC 100%)' }}
            >
              Write First Article
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9FC] border-b border-slate-200/70 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Article</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Author</th>
                  <th className="py-3.5 px-4">Reads</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Published Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {blogs.map((post) => (
                  <tr key={post.id} className="hover:bg-purple-50/20 transition-colors">
                    {/* Title & Slug */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3 max-w-md">
                        <div className="w-12 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {post.featured_image ? (
                            <img
                              src={post.featured_image.startsWith('/') ? `https://api.nanoshipy.com${post.featured_image}` : post.featured_image}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/blogs/${post.id}/edit`}
                            className="font-bold text-slate-900 hover:text-[#5B069A] transition truncate block"
                          >
                            {post.title}
                          </Link>
                          <span className="text-[10.5px] font-mono text-slate-400 truncate block">
                            /{post.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-purple-50 text-[#5B069A] border border-purple-200">
                        {post.category}
                      </span>
                    </td>

                    {/* Author */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 flex items-center justify-center shrink-0">
                          {post.author_name[0] || 'N'}
                        </div>
                        <span className="text-slate-800 font-medium">{post.author_name}</span>
                      </div>
                    </td>

                    {/* Views */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>{post.views_count || 0}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                          post.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${post.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="capitalize">{post.status}</span>
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                      {new Date(post.published_at || post.created_at).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`https://nanoshipy.com/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-purple-50 text-slate-600 hover:text-[#5B069A] transition cursor-pointer"
                          title="View live on nanoshipy.com"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          href={`/blogs/${post.id}/edit`}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-purple-50 text-slate-600 hover:text-[#5B069A] transition"
                          title="Edit article"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id, post.title)}
                          disabled={deletingId === post.id}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                          title="Delete article"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
