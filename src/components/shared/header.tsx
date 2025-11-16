
'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';
import { useSidebar } from '../ui/sidebar';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useAuth, useUser } from '@/firebase/provider';
import { signOut } from 'firebase/auth';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';


export function Header() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const auth = useAuth();
  const { user, isLoading } = useUser();

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    router.push('/login');
  };
  
  const getProfileLink = () => {
    if (pathname.startsWith('/admin')) {
        return '/admin/profile'; // Assuming admins have a profile page
    }
    if (pathname.startsWith('/teacher/class/')) {
        const classroomId = params.classroomId;
        return `/teacher/class/${classroomId}/profile`;
    }
    return '/teacher/dashboard'; // Fallback
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      {isMobile && <SidebarTrigger />}
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            {isLoading ? (
              <Skeleton className="h-9 w-9 rounded-full" />
            ) : (
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={user?.photoURL || ''}
                  alt={user?.displayName || 'User Avatar'}
                />
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel>{user?.displayName || user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={getProfileLink()}>
              <UserIcon className="mr-2" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
