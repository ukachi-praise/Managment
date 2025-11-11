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

export function SidebarNav({ role }: { role: 'admin' | 'teacher' }) {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const [teacherClassId, setTeacherClassId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'teacher' && user && firestore) {
      const fetchTeacherClass = async () => {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().assignedClassroomId) {
          setTeacherClassId(userDoc.data().assignedClassroomId);
        }
      };
      fetchTeacherClass();
    }
  }, [role, user, firestore]);
  
  const navItems = useMemo(() => {
    if (role === 'teacher') {
      const myClassHref = teacherClassId ? `/teacher/class/${teacherClassId}` : '/teacher/dashboard';
      return [
        { href: myClassHref, label: 'My Class', icon: Presentation },
        { href: '/teacher/results', label: 'Enter Results', icon: Book },
      ];
    }
    return adminNavItems;
  }, [role, teacherClassId]);

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
                variant={pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/teacher/dashboard' && item.href !== '/admin/dashboard') ? 'secondary' : 'ghost'}
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
