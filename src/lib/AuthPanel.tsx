import React, { useState } from "react";
import { Breadcrumbs } from "./breadcrumbs";
import { signin, signup, type AuthResponse } from "./client";

export function AuthPanel({
  title,
  note,
  onAuthenticated,
}: {
  title: string;
  note: string;
  onAuthenticated: (res: AuthResponse) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res =
        mode === "signin"
          ? await signin(identifier.trim(), password)
          : await signup({
              name: name.trim(),
              email: email.trim().toLowerCase(),
              username: username.trim().toLowerCase(),
              mobile: mobile.trim() || undefined,
              password,
            });
      setPassword("");
      onAuthenticated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="wx-page my-questions-page">
      <div className="wx-my-panel">
        <Breadcrumbs />
        <h1>{title}</h1>
        <p className="wx-book-note">{note}</p>
        <div className="wx-question-tabs" role="tablist">
          <button
            type="button"
            className={mode === "signin" ? "is-active" : ""}
            onClick={() => setMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === "signup" ? "is-active" : ""}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>
        <form className="wx-auth-form wx-my-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label>
                Your name
                <input type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                Username
                <input
                  type="text"
                  required
                  minLength={3}
                  pattern="[a-z0-9_]{3,30}"
                  title="3-30 chars: lowercase letters, numbers, underscore"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label>
                Mobile (optional, E.164)
                <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </label>
            </>
          ) : (
            <label>
              Email or username
              <input
                type="text"
                required
                minLength={3}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
            </label>
          )}
          <label>
            Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === "signup" ? (
            <p className="wx-auth-hint">Password needs 8+ characters, an uppercase letter, and a number.</p>
          ) : null}
          {error ? <p className="wx-auth-error">{error}</p> : null}
          <button type="submit" className="wx-btn wx-btn-primary wx-auth-submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </main>
  );
}