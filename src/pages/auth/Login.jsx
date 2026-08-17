import { useState } from "react";
import { useNavigate } from "react-router-dom";

import logo from "../../assets/images/ulwembu-logo.png";
import loginBackground from "../../assets/images/login-background.jpg";

export default function Login() {
  const navigate = useNavigate();

  const [portal, setPortal] = useState("superadmin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setError("");

    // Temporary demo credentials
    if (portal === "superadmin") {
      if (username === "admin" && password === "admin123") {
        navigate("/platform/dashboard");
      } else {
        setError("Invalid Super Admin credentials.");
      }
    } else {
      if (username === "tenant" && password === "tenant123") {
        navigate("/tenant/dashboard");
      } else {
        setError("Invalid Tenant credentials.");
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `
          linear-gradient(
            135deg,
            rgba(2, 6, 23, 0.78),
            rgba(15, 23, 42, 0.88)
          ),
          url(${loginBackground})
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(255,255,255,0.96)",
          borderRadius: "28px",
          padding: "36px",
          boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Logo + Heading */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <img
            src={logo}
            alt="Ulwembu Healthcare"
            style={{
              width: "90px",
              height: "90px",
              objectFit: "contain",
              marginBottom: "16px",
            }}
          />

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 800,
              color: "#10233f",
            }}
          >
            Ulwembu Healthcare
          </h1>

          <p style={{ marginTop: "10px", color: "#64748b" }}>
            Sign in to access the healthcare management platform
          </p>
        </div>

        {/* Portal Selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => setPortal("superadmin")}
            style={{
              padding: "12px",
              borderRadius: "14px",
              border:
                portal === "superadmin"
                  ? "2px solid #2563eb"
                  : "1px solid #dbe7ef",
              background:
                portal === "superadmin" ? "#e8f1ff" : "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Super Admin
          </button>

          <button
            type="button"
            onClick={() => setPortal("tenant")}
            style={{
              padding: "12px",
              borderRadius: "14px",
              border:
                portal === "tenant"
                  ? "2px solid #0f766e"
                  : "1px solid #dbe7ef",
              background:
                portal === "tenant" ? "#dff4f2" : "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tenant Portal
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: "grid", gap: "18px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
                color: "#10233f",
              }}
            >
              Username
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #dbe7ef",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
                color: "#10233f",
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #dbe7ef",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "12px 14px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "16px",
              border: "none",
              background:
                portal === "superadmin"
                  ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                  : "linear-gradient(135deg, #0f766e, #0b7f82)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "18px",
            borderTop: "1px solid #e2e8f0",
            fontSize: "12px",
            color: "#64748b",
            display: "grid",
            gap: "4px",
          }}
        >
          <div>
            <strong>Super Admin:</strong> admin / admin123
          </div>
          <div>
            <strong>Tenant:</strong> tenant / tenant123
          </div>
        </div>
      </div>
    </div>
  );
}
