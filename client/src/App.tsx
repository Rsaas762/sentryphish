import { AuthProvider } from "./lib/auth";
import { AppRouter } from "./router";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
