
'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
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
  Building,
  ArrowUpCircle,
  WalletCards
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
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

type NavItem = {
  href: (params: { classroomId?: string }) => string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  roles?: ("SuperAdmin" | "Admin" | "Teacher")[];
};

const adminNavItems: NavItem[] = [
  { href: () => '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: () => '/admin/ledger', label: 'Ledger', icon: WalletCards, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/students', label: 'Pupils', icon: Users, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/results', label: 'Results', icon: ClipboardList, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/classrooms', label: 'Classrooms', icon: Presentation, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/subjects', label: 'Subjects', icon: BookCopy, roles: ["SuperAdmin", "Admin"] },
  
  { href: () => '/admin/promotions', label: 'Promotions', icon: ArrowUpCircle, roles: ["SuperAdmin"] },
  { href: () => '/admin/staff', label: 'Staff', icon: Users2, roles: ["SuperAdmin"] },
  { href: () => '/admin/sessions', label: 'Sessions', icon: Building, roles: ["SuperAdmin"] },
  { href: () => '/admin/info', label: 'School Info', icon: Info, roles: ["SuperAdmin"] },
  { href: () => '/admin/remarks', label: 'Remarks', icon: MessageSquareQuote, roles: ["SuperAdmin"] },
  { href: () => '/admin/templates', label: 'Templates', icon: LayoutTemplate, roles: ["SuperAdmin"] },
  { href: () => '/admin/students/deleted', label: 'Recycle Bin', icon: Trash2, roles: ["SuperAdmin"] },
  { href: () => '/admin/settings', label: 'Settings', icon: Settings, roles: ["SuperAdmin"] },
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

  const allItems = role === 'admin' ? adminNavItems : teacherNavItems;
  const navItems = allItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role as any);
  });

  const isActive = (href: string, exact?: boolean) => {
    if (pathname.includes('/profile') && href.includes('/profile')) return true;
    if (href.startsWith('/teacher/class/')) return pathname === href;
    if (href === '/teacher/dashboard' && classroomIdForNav) return pathname === `/teacher/class/${classroomIdForNav}`;
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
