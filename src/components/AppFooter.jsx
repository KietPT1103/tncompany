import React from "react";

export default function AppFooter({ isHome }) {
  return (
    <footer className="site-footer">
      <p>
        {isHome
          ? "© 2026 T&N Company. Trang chủ giới thiệu doanh nghiệp và năng lực vận hành."
          : "© 2026 Hệ sinh thái Ông Quan. "}
      </p>
    </footer>
  );
}
