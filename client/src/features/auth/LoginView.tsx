import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../stores/session";
import { api } from "../../services/api";
import type { DataEnvelope, UserProfile } from "../../types";

export default function LoginView() {
  const navigate = useNavigate();
  const { loginMock, isLoading } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<UserProfile[]>([]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await api<DataEnvelope<UserProfile[]>>(
          "/api/v1/auth/mock-accounts"
        );
        if (response.isSuccess && response.data) {
          setAccounts(response.data);
        }
      } catch (err) {
        setError("Unable to load mock accounts.");
      }
    };

    loadAccounts();
  }, []);

  const handleLogin = async (userId: string) => {
    setError(null);

    try {
      await loginMock(userId);
      navigate("/home");
    } catch (err) {
      setError("Unable to reach the server.");
    }
  };

  return (
    <section className="panel">
      <h1>Welcome to Chamble</h1>
      <p>Mock login uses server data envelopes for now.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="stack">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            className="button"
            onClick={() => handleLogin(account.id)}
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : `Login as ${account.displayName}`}
          </button>
        ))}
      </div>
    </section>
  );
}
