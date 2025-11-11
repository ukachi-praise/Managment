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
import { useUser } from '@/firebase';
import { useMemo } from 'react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  isDynamic?: boolean;
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
  { href: '/teacher/class', label: 'My Class', icon: Presentation, isDynamic: true },
  { href: '/teacher/results', label: 'Enter Results', icon: Book },
];

export function SidebarNav({ role }: { role: 'admin' | 'teacher' }) {
  const pathname = usePathname();
  const params = useParams();
  
  const navItems = useMemo(() => {
    if (role === 'teacher') {
      const classroomId = params.classroomId;
      return [
        { href: `/teacher/class/${classroomId}`, label: 'My Class', icon: Presentation },
        { href: '/teacher/results', label: 'Enter Results', icon: Book },
      ];
    }
    return adminNavItems;
  }, [role, params]);

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
                variant={pathname.startsWith(item.href) ? 'secondary' : 'ghost'}
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
