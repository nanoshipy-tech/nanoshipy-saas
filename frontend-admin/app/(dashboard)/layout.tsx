'use client';

import React from 'react';
import { AdminShell } from '@/components/layout/AdminShell';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
