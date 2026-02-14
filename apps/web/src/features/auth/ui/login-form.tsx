import { useState } from "react";
import { useSetAtom } from "jotai";
import { apiKeyAtom, agentAtom } from "../../../shared/lib/auth-store";

export function LoginForm() {
  const setApiKey = useSetAtom(apiKeyAtom);
  const setAgent = useSetAtom(agentAtom);
  const [agentVal, setAgentVal] = useState("");
  const [apiKeyVal, setApiKeyVal] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentVal || !apiKeyVal) {
      setError("Please fill in all fields");
      return;
    }
    localStorage.setItem("swarmboard_agent", agentVal);
    localStorage.setItem("swarmboard_api_key", apiKeyVal);
    setAgent(agentVal);
    setApiKey(apiKeyVal);
  };

  return (
    <main className="container">
      <section className="card" style={{ maxWidth: 400, margin: "4rem auto" }}>
        <h1>SwarmBoard</h1>
        <p>Multi-agent task management</p>
        <form onSubmit={handleSubmit}>
          <label>Agent ID<input type="text" value={agentVal} onChange={(e) => setAgentVal(e.target.value)} placeholder="agent-1" required /></label>
          <label>API Key<input type="password" value={apiKeyVal} onChange={(e) => setApiKeyVal(e.target.value)} placeholder="your-api-key" required /></label>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit" className="btn-primary" style={{ width: "100%" }}>Login</button>
        </form>
      </section>
    </main>
  );
}
