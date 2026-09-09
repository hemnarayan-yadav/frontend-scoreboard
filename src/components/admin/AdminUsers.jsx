import { useEffect, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  useEffect(() => {
    api("/api/auth/users").then(setUsers);
  }, []);
  async function create(event) {
    event.preventDefault();
    const result = await api("/api/auth/users", jsonOptions("POST", form));
    setUsers([result.user, ...users]);
    setForm({ name: "", email: "", password: "" });
  }
  return (
    <div className="user-management">
      <div>
        <p className="eyebrow">Access management</p>
        <h2>Operators</h2>
      </div>
      <form className="user-form" onSubmit={create}>
        <input
          placeholder="Full name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Temporary password"
          value={form.password}
          onChange={(event) =>
            setForm({ ...form, password: event.target.value })
          }
          required
        />
        <button className="primary-button">Create admin</button>
      </form>
      <div className="user-list">
        {users.map((user) => (
          <div className="user-row" key={user._id}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <b>{user.role}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
