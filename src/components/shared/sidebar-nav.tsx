
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
  User as UserIcon,
  Trash2,
  Sheet,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Logo } from './logo';
import { Button } from '../ui/button';
import { useUser, useFirestore } from '@/firebase/provider';
import { useMemo, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

type NavItem = {
  href: (params: { classroomId?: string }) => string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
};

const adminNavItems: NavItem[] = [
  { href: () => '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: () => '/admin/students', label: 'Pupils', icon: Users },
  { href: () => '/admin/staff', label: 'Staff', icon: Users2 },
  { href: () => '/admin/classrooms', label: 'Classrooms', icon: Presentation },
  { href: () => '/admin/subjects', label: 'Subjects', icon: BookCopy },
  { href: () => '/admin/enrollments', label: 'Enrollments', icon: Users },
  { href: () => '/admin/info', label: 'Info', icon: Info },
  { href: () => '/admin/remarks', label: 'Remarks', icon: MessageSquareQuote },
  { href: () => '/admin/results', label: 'Results', icon: ClipboardList },
  { href: () => '/admin/broadsheet', label: 'Broadsheet', icon: Sheet },
  { href: () => '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { href: () => '/admin/students/deleted', label: 'Recycle Bin', icon: Trash2 },
  { href: () => '/admin/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav({ role }: { role: 'admin' | 'teacher' }) {
  const pathname = usePathname();
  const params = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const [teacherClassroomId, setTeacherClassroomId] = useState<string | null>(null);
  const { setOpenMobile } = useSidebar();


  useEffect(() => {
    if (role === 'teacher' && user && firestore) {
      const fetchUserClass = async () => {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().assignedClassroomId) {
          setTeacherClassroomId(userDoc.data().assignedClassroomId);
        }
      };
      fetchUserClass();
    }
  }, [role, user, firestore]);
  
  const classroomIdForNav = params.classroomId as string || teacherClassroomId;

  const teacherNavItems: NavItem[] = [
    { href: ({classroomId}) => classroomId ? `/teacher/class/${classroomId}` : '/teacher/dashboard', label: 'My Class', icon: Presentation, exact: true },
    { href: ({classroomId}) => classroomId ? `/teacher/class/${classroomId}/profile` : '/teacher/dashboard', label: 'Profile', icon: UserIcon },
  ];

  const navItems = role === 'admin' ? adminNavItems : teacherNavItems;

  const isActive = (href: string, exact?: boolean) => {
    // Special handling for nested routes
    if (pathname.includes('/profile') && href.includes('/profile')) return true;
    if (pathname.includes('/broadsheet') && href.includes('/broadsheet')) return true;

    // Special handling for the dynamic "My Class" link
    if (href.startsWith('/teacher/class/')) {
        // Only match if it's the class page and not a sub-page like profile or results
        return pathname === href;
    }
    if (href === '/teacher/dashboard' && classroomIdForNav) {
        return pathname === `/teacher/class/${classroomIdForNav}`;
    }
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const href = item.href({ classroomId: classroomIdForNav ?? undefined });
            return (
                <SidebarMenuItem key={item.label}>
                <Button
                    asChild
                    variant={isActive(href, item.exact) ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={handleLinkClick}
                >
                    <Link href={href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                    </Link>
                </Button>
                </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

    