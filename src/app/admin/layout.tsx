import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ok } = await requireAdmin();
  if (!ok) {
    redirect('/login?next=/admin');
  }

  return (
    <div className="flex-1 w-full bg-slate-950 text-white">
      {children}
    </div>
  );
}
