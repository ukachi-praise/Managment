
'use client'; // This layout is for public pages and needs no server logic.

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // This is a simple pass-through layout for login, register, etc.
  // It does not contain any authentication guards or complex structure.
  return <>{children}</>;
}
