import { Panel } from "./components/ui/Panel";
import { Stat } from "./components/ui/Stat";

export default function App() {
  return (
    <div className="min-h-full p-8">
      <Panel title="System check">
        <Stat label="Status" value="ONLINE" tone="accent" pulse />
      </Panel>
    </div>
  );
}
