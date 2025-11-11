
export default function ResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-muted min-h-screen">{children}</div>;
}
