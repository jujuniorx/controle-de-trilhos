import { acessarPatioAction } from './actions';

export default function AcessoPatioPage() {
  return (
    <form action={acessarPatioAction}>
      <input name="pin" type="password" inputMode="numeric" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
