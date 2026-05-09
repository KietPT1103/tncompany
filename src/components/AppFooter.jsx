export default function AppFooter({ pageId }) {
  if (pageId === "home") {
    return null;
  }

  const footerCopy =
    pageId === "about"
      ? "© 2026 T&N Company. Trang giới thiệu doanh nghiệp và năng lực vận hành."
      : "© 2026 Hệ sinh thái Ông Quan.";

  return (
    <footer className="site-footer">
      <p>{footerCopy}</p>
    </footer>
  );
}
