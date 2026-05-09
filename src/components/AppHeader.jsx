import cafeLogo from "../public/images/cf/logo_cf_nav.png";

export default function AppHeader({ activePageId, onNavigate, pages }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          href="/"
          className="brand"
          aria-label="Trang chu he sinh thai Ong Quan"
          onClick={(event) => {
            if (!onNavigate) {
              return;
            }

            event.preventDefault();
            onNavigate("home");
          }}
        >
          <img className="brand-logo" src={cafeLogo} alt="Tiem ca phe Ong Quan" />
        </a>

        <nav className="page-nav" aria-label="Dieu huong trang">
          {pages.map((page) => (
            <a
              key={page.id}
              href={page.hash}
              className={activePageId === page.id ? "is-active" : ""}
              onClick={(event) => {
                if (!onNavigate || page.external) {
                  return;
                }

                event.preventDefault();
                onNavigate(page.id);
              }}
              title={page.label}
            >
              {page.shortLabel}
            </a>
          ))}
        </nav>

        <div className="header-spacer" aria-hidden="true" />
      </div>
    </header>
  );
}
