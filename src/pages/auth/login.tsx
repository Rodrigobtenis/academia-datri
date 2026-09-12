import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Academia Datri</h1>
        <p className="text-sm text-gray-500 mb-6">Iniciá sesión para continuar</p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
