'use client';

import { FormEvent, useState } from 'react';

export default function ResetSenhaPage() {
  const [email, setEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem(null);

    try {
      const response = await fetch('/api/reset-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          novaSenha,
          token: 'reset-trilhos-2026',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensagem({
          tipo: 'sucesso',
          texto: `Senha atualizada! Login: junior | Senha: ${novaSenha}`,
        });
        setEmail('');
        setNovaSenha('');
      } else {
        setMensagem({
          tipo: 'erro',
          texto: data.erro || 'Erro ao atualizar senha',
        });
      }
    } catch (error) {
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao conectar ao servidor',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reset de Senha</h1>
          <p className="text-slate-300 mb-6">Defina uma nova senha para seu usuário</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email do Usuário
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nova Senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="Digite a nova senha"
              />
            </div>

            {mensagem && (
              <div
                className={`p-4 rounded ${
                  mensagem.tipo === 'sucesso'
                    ? 'bg-green-500/20 border border-green-500 text-green-300'
                    : 'bg-red-500/20 border border-red-500 text-red-300'
                }`}
              >
                {mensagem.texto}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded transition-colors"
            >
              {loading ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </form>

          <p className="text-slate-400 text-xs mt-6 text-center">
            Após atualizar, use <strong>junior</strong> para logar
          </p>
        </div>
      </div>
    </div>
  );
}
