import { login } from './actions';

export default function LoginPage() {
  return (
    <form action={async (formData) => { await login(formData); }}>
      <input name="email" type="email" required />
      <input name="senha" type="password" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
