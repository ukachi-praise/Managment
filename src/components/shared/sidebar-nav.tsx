'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Book,
  ClipboardList,
  Home,
  Settings,
  Users,
  Presentation,
  BookCopy,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Logo } from './logo';
import { Button } from '../ui/button';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const adminNavItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/classrooms', label: 'Classrooms', icon: Presentation },
  { href: '/admin/subjects', label: 'Subjects', icon: BookCopy },
  { href: '/admin/results', label: 'Results', icon: ClipboardList },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const teacherNavItems: NavItem[] = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: Home },
  { href: '/teacher/results', label: 'Enter Results', icon: Book },
];

export function SidebarNav({ role }: { role: 'admin' | 'teacher' }) {
  const pathname = usePathname();
  const navItems = role === 'admin' ? adminNavItems : teacherNavItems;

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
                variant={pathname === item.href ? 'secondary' : 'ghost'}
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
      <SidebarFooter>
        {/* Placeholder for footer content if needed */}
      </SidebarFooter>
    </Sidebar>
  );
}
