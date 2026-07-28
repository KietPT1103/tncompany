import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import cafeLogo from "../public/images/cf/logo_cf_nav.png";

export default function AppHeader({ activePageId, onNavigate, pages }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const handleNavigate = (event, page) => {
    if (!onNavigate || page.external) return;

    event.preventDefault();
    onNavigate(page.id);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/15 bg-[#795200] shadow-[0_4px_16px_rgba(45,25,5,0.18)]">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 md:grid md:h-[108px] md:grid-cols-[1fr_auto_1fr] md:px-8 lg:h-[80px]">
          {/* Logo */}
          <a
            href="/"
            className="group absolute left-1/2 top-3 flex -translate-x-1/2 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:static md:w-fit md:translate-x-0 md:translate-y-1"
            aria-label="Trang chủ hệ sinh thái Ông Quan"
            onClick={(event) => {
              if (!onNavigate) return;

              event.preventDefault();
              onNavigate("home");
              setIsMenuOpen(false);
            }}
          >
            <img
              className="h-14 w-auto object-contain transition-transform duration-200 group-hover:scale-105 md:h-[76px] lg:w-30"
              src={cafeLogo}
              alt="Tiệm cà phê Ông Quan"
            />
          </a>

          {/* Menu desktop */}
          <nav
            className="hidden items-center justify-center gap-2 md:flex"
            aria-label="Điều hướng trang"
          >
            {pages.map((page) => {
              const isActive = activePageId === page.id;

              return (
                <a
                  key={page.id}
                  href={page.hash}
                  aria-current={isActive ? "page" : undefined}
                  className={`font-sans relative whitespace-nowrap rounded border px-5 py-2 text-[15px] font-semibold uppercase tracking-[0.025em] transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] ${
                    isActive
                      ? "border-white/90 bg-white/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                      : "border-transparent text-[#fff6e8] hover:border-white/35 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={(event) => handleNavigate(event, page)}
                  title={page.label}
                >
                  {page.shortLabel}
                </a>
              );
            })}
          </nav>

          {/* Giữ menu nằm chính giữa */}
          <div className="hidden md:block" aria-hidden="true" />

          {/* Hamburger mobile */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md text-[#fff6e8] transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:hidden"
            aria-label="Mở menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu className="h-8 w-8" strokeWidth={2} />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[80] md:hidden ${
          isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => setIsMenuOpen(false)}
          className={`absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ${
            isMenuOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute right-0 top-0 flex h-dvh w-[min(86vw,380px)] flex-col bg-[#795200] shadow-[-12px_0_32px_rgba(31,17,7,0.32)] transition-transform duration-300 ease-out ${
            isMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-[88px] items-center justify-between border-b border-white/15 px-5">
            <img
              className="h-16 w-auto object-contain"
              src={cafeLogo}
              alt="Tiệm cà phê Ông Quan"
            />

            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-[#fff6e8] transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="Đóng menu"
            >
              <X className="h-8 w-8" strokeWidth={2} />
            </button>
          </div>

          <nav
            className="flex-1 overflow-y-auto px-5 py-6"
            aria-label="Điều hướng trên thiết bị di động"
          >
            {pages.map((page) => {
              const isActive = activePageId === page.id;

              return (
                <a
                  key={page.id}
                  href={page.hash}
                  aria-current={isActive ? "page" : undefined}
                  className={`block border-b border-white/15 px-4 py-5 text-lg font-semibold uppercase tracking-[0.02em] transition-colors duration-200 last:border-b-0 ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-[#fff6e8] hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={(event) => handleNavigate(event, page)}
                >
                  {page.shortLabel}
                </a>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
}
