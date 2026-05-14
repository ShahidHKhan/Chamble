import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../stores/session";
import type { DataEnvelope, DataListEnvelope, Friend, UserProfile } from "../../types";


export default function HomeView() {
  const navigate = useNavigate();
  const { api, setUser, user } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setError(null);
      try {
        const profileResponse = await api<DataEnvelope<UserProfile>>(
          "/api/v1/profile"
        );
        if (profileResponse.isSuccess && profileResponse.data) {
          setProfile(profileResponse.data);
          setUser(profileResponse.data);
        }

        const friendsResponse = await api<DataListEnvelope<Friend>>(
          "/api/v1/friends?page=1&pageSize=10"
        );
        if (friendsResponse.isSuccess && friendsResponse.data) {
          setFriends(friendsResponse.data);
        }
      } catch (err) {
        setError("Unable to load profile data.");
      }
    };

    loadData();
  }, []);

  const activeProfile = profile ?? user;

  const stats = [
    { label: "Rating", value: activeProfile?.rating ?? "--" },
    { label: "Games", value: activeProfile?.gamesPlayed ?? "--" },
    { label: "Wins", value: activeProfile?.wins ?? "--" },
    { label: "Losses", value: activeProfile?.losses ?? "--" }
  ];

  return (
    <section className="panel panel--wide">
      <div className="home__header">
        <div>
          <h1>Home</h1>
          <p>Welcome back, {activeProfile?.displayName ?? "Player"}.</p>
        </div>
        <div className="home__meta">
          <div>{activeProfile?.email ?? ""}</div>
          <div className="home__id">ID: {activeProfile?.id ?? "--"}</div>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="home__grid">
        <div className="card">
          <h2>Profile</h2>
          <div className="stats">
            {stats.map((stat) => (
              <div key={stat.label} className="stats__item">
                <span className="stats__label">{stat.label}</span>
                <span className="stats__value">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Friends</h2>
          <ul className="list">
            {friends.map((friend: Friend) => (
              <li key={friend.id} className="list__item">
                <span>{friend.displayName}</span>
                <span className={`badge badge--${friend.status}`}>{friend.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Game Modes</h2>
        <div className="modes">
          <button
            type="button"
            className="button"
            onClick={() => navigate("/play/chess-blackjack")}
          >
            ChessBlackJack
          </button>
          <button type="button" className="button button--ghost" disabled>
            Classic Chess (upcoming)
          </button>
          <button type="button" className="button button--ghost" disabled>
            Blitz (upcoming)
          </button>
        </div>
      </div>
    </section>
  );
}
