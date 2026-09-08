import { useRef, useState } from 'react';
import {
  FiBox,
  FiGrid,
  FiHome,
  FiLayers,
  FiMenu,
  FiPackage,
  FiCreditCard,
  FiFileText,
  FiTruck,
  FiServer,
  FiShoppingBag,
  FiRotateCcw,
  FiMessageCircle,
  FiUsers,
  FiStar,
  FiTag,
  FiMessageSquare,
  FiActivity,
  FiSend,
  FiX,
} from 'react-icons/fi';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import { useAuthStore } from '../../stores/auth-store';

const navigation = [
  { end: true, icon: FiGrid, label: 'Dashboard', to: '/admin' },
  { icon: FiShoppingBag, label: 'Products', to: '/admin/products' },
  { icon: FiLayers, label: 'Categories', to: '/admin/categories' },
  { icon: FiPackage, label: 'Inventory', to: '/admin/inventory' },
  { icon: FiStar, label: 'Featured', to: '/admin/featured' },
  { icon: FiMessageSquare, label: 'Reviews', to: '/admin/reviews' },
  { icon: FiTag, label: 'Coupons', to: '/admin/coupons' },
  { icon: FiActivity, label: 'Cart & purchases', to: '/admin/commerce-activity' },
  { icon: FiSend, label: 'Campaigns', to: '/admin/campaigns' },
  { icon: FiBox, label: 'Orders', to: '/admin/orders' },
  { icon: FiTruck, label: 'Shipments', to: '/admin/shipments' },
  { icon: FiCreditCard, label: 'Payments', to: '/admin/payments' },
  { icon: FiRotateCcw, label: 'Returns', to: '/admin/returns' },
  { icon: FiMessageCircle, label: 'Support', to: '/admin/support' },
  { icon: FiUsers, label: 'Users', to: '/admin/users' },
  { icon: FiServer, label: 'System', to: '/admin/system' },
  { icon: FiFileText, label: 'Audit', to: '/admin/audit' },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const user = useAuthStore((state) => state.user);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="font-display text-2xl tracking-[0.12em]">VEYORA</p>
        <p className="mt-1 text-[0.65rem] tracking-[0.18em] text-white/45 uppercase">
          Administration
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Administration">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                isActive
                  ? 'bg-white text-black'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`
            }
            {...(item.end ? { end: true } : {})}
            key={item.to}
            {...(onNavigate ? { onClick: onNavigate } : {})}
            to={item.to}
          >
            <item.icon aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="truncate text-xs text-white/45">{user?.email}</p>
        <Link
          className="mt-4 flex items-center gap-2 text-xs text-white/65 hover:text-white"
          to="/"
        >
          <FiHome /> Return to store
        </Link>
      </div>
    </div>
  );
};

export const AdminLayout = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useDialogFocus<HTMLElement>({
    active: isOpen,
    onClose: () => setIsOpen(false),
  });

  return (
    <div className="bg-porcelain min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="bg-ink fixed inset-y-0 left-0 z-30 hidden w-64 text-white lg:block">
        <SidebarContent />
      </aside>
      {isOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close administration navigation"
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside
            aria-label="Administration navigation drawer"
            aria-modal="true"
            className="bg-ink relative h-full w-[min(20rem,85vw)] text-white shadow-2xl"
            ref={drawerRef}
            role="dialog"
            tabIndex={-1}
          >
            <button
              aria-label="Close navigation"
              className="absolute top-5 right-4 rounded-full p-2 text-white/70 hover:bg-white/10"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <FiX />
            </button>
            <SidebarContent onNavigate={() => setIsOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="min-w-0 lg:col-start-2">
        <header className="border-ink/10 sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button
            aria-expanded={isOpen}
            aria-label="Open administration navigation"
            className="border-ink/10 rounded-xl border p-2.5"
            onClick={() => setIsOpen(true)}
            ref={menuButtonRef}
            type="button"
          >
            <FiMenu />
          </button>
          <span className="font-display text-xl">Veyora Admin</span>
          <span className="w-10" />
        </header>
        <main className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8 xl:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
