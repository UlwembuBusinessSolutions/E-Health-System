import { useEffect, useState } from "react";
type Result = { state: "idle" | "running" | "passed" | "failed"; message: string };
const endpoint = "/__local/pharmacy-concurrency";
export function PharmacyConcurrencyCheck() {
  const [result, setResult] = useState<Result>({state:"idle", message:""});
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      try {
        const response = await fetch(endpoint, {signal:controller.signal});
        if (!response.ok) throw new Error("Development test service unavailable. Restart the local frontend server.");
        setResult(await response.json());
      } catch (error) {
        if (!controller.signal.aborted) setResult({state:"failed",message:error instanceof Error ? error.message : "Unable to read test result."});
      }
    };
    void read();
    const timer = setInterval(() => { void read(); }, 3000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  async function run() {
    setStarting(true);
    try {
      const response = await fetch(endpoint, {method:"POST", headers:{"X-Pharmacy-Development-Check":"1"}});
      if (!response.ok) throw new Error("Could not start test. Check the local development server.");
      setResult(await response.json());
    } catch (error) { setResult({state:"failed",message:error instanceof Error ? error.message : "Test failed to start."}); }
    finally { setStarting(false); }
  }
  return <section className="pharmacy-panel pharmacy-concurrency" aria-labelledby="pharmacy-concurrency-title">
    <div><h2 id="pharmacy-concurrency-title">Concurrency test</h2><p>Development check for two dispensing transactions at the same clinic.</p>
    {result.message && <p className="pharmacy-test-result" data-state={result.state} role="status">{result.message}</p>}</div>
    <button className="pharmacy-button secondary" disabled={starting || result.state === "running"} onClick={() => void run()}>{starting || result.state === "running" ? "Running test..." : "Run test"}</button>
  </section>;
}
