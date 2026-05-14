import { Link } from "react-router-dom";

export default function LoginView() {
  return (
    <section className="panel">
      <h1>Welcome to Chamble</h1>
      <p>Login and profile wiring will land here.</p>
      <Link to="/lobby" className="button">
        Continue to Lobby
      </Link>
    </section>
  );
}
