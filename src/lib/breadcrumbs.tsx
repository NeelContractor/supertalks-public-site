import { Link, useLocation } from "@tanstack/react-router";

const TRAILS: Record<string, { label: string; to?: string }[]> = {
  "/dashboard": [{ label: "Dashboard" }],
  "/my/questions": [{ label: "Dashboard", to: "/dashboard" }, { label: "Questions" }],
  "/my/bookings": [{ label: "Dashboard", to: "/dashboard" }, { label: "Bookings" }],
};

const SITE_SLUG_KEY = "supertalks:site-slug";

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const trail = TRAILS[pathname];
  if (pathname === "/" || !trail) return null;

  const slug =
    typeof localStorage !== "undefined"
      ? (localStorage.getItem(SITE_SLUG_KEY) ?? "").trim()
      : "";

  return (
    <nav aria-label="Breadcrumb" className="wx-crumbs">
      <ol className="wx-crumbs-list">
        <li className="wx-crumbs-item">
          {slug ? (
            <Link to="/$slug" params={{ slug }} className="wx-crumbs-link">
              Home
            </Link>
          ) : (
            <Link to="/" className="wx-crumbs-link">
              Home
            </Link>
          )}
        </li>
        {trail.map((crumb, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={crumb.label} className="wx-crumbs-item">
              <span className="wx-crumbs-sep" aria-hidden="true">
                /
              </span>
              {crumb.to && !last ? (
                <Link to={crumb.to} className="wx-crumbs-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="wx-crumbs-current" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}