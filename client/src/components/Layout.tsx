import { ReactNode } from "react";
import { Link } from "react-router-dom";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout__header">
        <Link to="/" className="layout__brand">
          Chamble
        </Link>
        <nav className="layout__nav">
          <Link to="/lobby">Lobby</Link>
        </nav>
      </header>
      <main className="layout__main">{children}</main>
    </div>
  );
}
