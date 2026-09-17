import { loginAction } from './actions';

export default function LoginPage() {
  return (
    <form action={loginAction}>
      <input name="email" type="email" required />
      <input name="senha" type="password" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
