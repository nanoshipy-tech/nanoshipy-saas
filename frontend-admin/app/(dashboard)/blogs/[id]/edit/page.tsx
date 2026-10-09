'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { BlogEditorStudio } from '@/components/blogs/BlogEditorStudio';

export default function EditBlogPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  if (!id) return null;

  return <BlogEditorStudio initialId={id} />;
}
