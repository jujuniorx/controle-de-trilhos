import { login } from './actions';

export default function LoginPage() {
  return (
    <form action={login}>
      <input name="email" type="email" required />
      <input name="senha" type="password" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
