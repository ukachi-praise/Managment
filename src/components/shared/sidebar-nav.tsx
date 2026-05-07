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
import { cn } from '@/lib/utils';

type NavItem = {
  href: (params: { classroomId?: string }) => string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  roles?: ("SuperAdmin" | "Admin" | "Teacher")[];
};

const adminNavItems: NavItem[] = [
  { href: () => '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: () => '/admin/ledger', label: 'Fee Ledger', icon: WalletCards, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/students', label: 'Pupil List', icon: Users, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/results', label: 'View Results', icon: ClipboardList, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/classrooms', label: 'Manage Classes', icon: Presentation, roles: ["SuperAdmin", "Admin"] },
  { href: () => '/admin/subjects', label: 'Subject Manager', icon: BookCopy, roles: ["SuperAdmin", "Admin"] },
  
  { href: () => '/admin/promotions', label: 'Promotions', icon: ArrowUpCircle, roles: ["SuperAdmin"] },
  { href: () => '/admin/staff', label: 'Staff Accounts', icon: Users2, roles: ["SuperAdmin"] },
  { href: () => '/admin/sessions', label: 'Academic Sessions', icon: Building, roles: ["SuperAdmin"] },
  { href: () => '/admin/info', label: 'School Settings', icon: Info, roles: ["SuperAdmin"] },
  { href: () => '/admin/remarks', label: 'Predefined Remarks', icon: MessageSquareQuote, roles: ["SuperAdmin"] },
  { href: () => '/admin/templates', label: 'Report Templates', icon: LayoutTemplate, roles: ["SuperAdmin"] },
  { href: () => '/admin/students/deleted', label: 'Recycle Bin', icon: Trash2, roles: ["SuperAdmin"] },
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
    { href: ({classroomId}) => classroomId ? `/teacher/class/${classroomId}/profile` : '/teacher/dashboard', label: 'My Profile', icon: UserIcon },
  ];

  const allItems = role === 'admin' ? adminNavItems : teacherNavItems;
  
  const navItems = allItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role as any);
  });

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  return (
    <Sidebar className="border-r shadow-sm">
      <SidebarHeader className="border-b px-4 py-6 bg-muted/20">
        <Logo className="text-xl" />
        {user?.role && (
            <div className="mt-2 flex items-center gap-1.5 px-1">
                <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", user.role === 'SuperAdmin' ? "bg-red-500" : "bg-blue-500")} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{user.role} ACCESS</span>
            </div>
        )}
      </SidebarHeader>
      <SidebarContent className="p-3">
        <SidebarMenu className="space-y-1">
          {navItems.map((item) => {
            const href = item.href({ classroomId: classroomIdForNav ?? undefined });
            const active = isActive(href, item.exact);
            return (
                <SidebarMenuItem key={item.label}>
                <Button
                    asChild
                    variant={active ? 'secondary' : 'ghost'}
                    className={cn(
                        "w-full justify-start transition-all duration-200",
                        active ? "font-bold shadow-sm" : "text-muted-foreground hover:translate-x-1"
                    )}
                    onClick={handleLinkClick}
                >
                    <Link href={href}>
                        <item.icon className={cn("mr-3 h-4 w-4", active ? "text-primary" : "")} />
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
