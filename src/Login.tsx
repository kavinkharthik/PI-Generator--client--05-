import React, { useState } from "react";
import { FaUser, FaLock } from "react-icons/fa";
import "./Login.css";


interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // React.useEffect logic for logo removed - using direct src

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (username.trim() === "PIGENERATOR" && password.trim() === "PI@GENERATOR") {
      onLogin();
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/logo.png?v=6" alt="Company Logo" className="login-logo" />
        <h2 className="company-name">SRI CHAKRI TRADERS</h2>
        <p className="sub-company-name">PI GENERATOR</p>
        <div className="input-group">
          <FaUser className="input-icon" />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="input-group">
          <FaLock className="input-icon" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button onClick={handleLogin}>Login</button>
      </div>
    </div>
  );
};

export default Login;







