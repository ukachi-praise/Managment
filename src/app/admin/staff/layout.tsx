'use client';

import AuthGuard from '@/components/auth/AuthGuard';

export default function StaffManagementLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allow={['SuperAdmin']}>{children}</AuthGuard>;
}
