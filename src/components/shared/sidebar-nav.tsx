
'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  Book,
  ClipboardList,
  Home,
  Settings,
  Users,
  Presentation,
  BookCopy,
  MessageSquareQuote,
  LayoutTemplate,
  Info,
  Users2,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Logo } from './logo';
import { Button } from '../ui/button';
import { useUser, useFirestore } from '@/firebase';
import { useMemo, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
};

const adminNavItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/staff', label: 'Staff', icon: Users2 },
  { href: '/admin/classrooms', label: 'Classrooms', icon: Presentation },
  { href: '/admin/subjects', label: 'Subjects', icon: BookCopy },
  { href: '/admin/info', label: 'Info', icon: Info },
  { href: '/admin/remarks', label: 'Remarks', icon: MessageSquareQuote },
  { href: '/admin/results', label: 'Results', icon: ClipboardList },
  { href: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const teacherNavItems: NavItem[] = [
    { href: '/teacher/dashboard', label: 'My Class', icon: Presentation, exact: true },
];

export function SidebarNav({ role }: { role: 'admin' | 'teacher' }) {
  const pathname = usePathname();
  const navItems = role === 'admin' ? adminNavItems : teacherNavItems;

  const isActive = (href: string, exact?: boolean) => {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Button
                asChild
                variant={isActive(item.href, item.exact) ? 'secondary' : 'ghost'}
                className="w-full justify-start"
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
