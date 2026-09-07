import React, { useState } from "react";
import { signin, signup, type AuthResponse } from "./client";

type Mode = "signin" | "signup";

export function AuthModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (res: AuthResponse) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

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
    <div className="wx-modal-backdrop" onClick={onClose}>
      <div
        className="wx-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "signin" ? "Sign in" : "Create account"}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="wx-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" strokeWidth="20" aria-hidden="true">
            <path d="M40 100h120" />
          </svg>
        </button>

        <h2 className="wx-modal-title">{mode === "signin" ? "Sign In" : "Create Account"}</h2>
        <p className="wx-modal-sub">
          {mode === "signin"
            ? "Welcome back. Sign in to book a session or ask a question."
            : "Create a free account to book sessions and ask questions."}
        </p>

        <div className="wx-modal-tabs">
          <button
            type="button"
            className={mode === "signin" ? "is-active" : ""}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === "signup" ? "is-active" : ""}
            onClick={() => switchMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <form className="wx-auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label>
                Your name
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  autoFocus
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
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
                  placeholder="jane_doe"
                />
              </label>
              <label>
                Mobile (optional, E.164)
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+919876543210"
                />
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
            <input
              type="password"
              required
              minLength={1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
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
    </div>
  );
}