import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { ConnectionMonitor } from "@/shared/connection/ConnectionMonitor";

function App() {
  return (
    <AppProviders>
      <ConnectionMonitor />
      <AppRouter />
    </AppProviders>
  );
}

export default App;
