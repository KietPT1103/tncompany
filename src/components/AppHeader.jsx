import React from "react";

export default function AppHeader({ activePageId, onNavigate, pages }) {
  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-mark">T&N</span>
        <div>
          <p className="brand-title">T&N Company</p>
          <p className="brand-sub">Trang chủ doanh nghiệp & hệ sinh thái Ông Quan</p>
        </div>
      </div>

      <nav className="page-nav" aria-label="Điều hướng trang">
        {pages.map((page) => (
          <a
            key={page.id}
            href={page.hash}
            className={activePageId === page.id ? "is-active" : ""}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(page.id);
            }}
            title={page.label}
          >
            {page.shortLabel}
          </a>
        ))}
      </nav>
    </header>
  );
}
