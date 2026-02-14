import { useAtom } from "jotai";
import { apiKeyAtom } from "../shared/lib/auth-store";
import { LoginForm } from "../features/auth/ui/login-form";
import { Board } from "../widgets/board/board";

export function App() {
  const [apiKey] = useAtom(apiKeyAtom);
  return apiKey ? <Board /> : <LoginForm />;
}
