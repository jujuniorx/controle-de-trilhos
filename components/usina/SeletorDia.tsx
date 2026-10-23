'use client';

import { useRouter } from 'next/navigation';

/**
 * Campo "Dia" de uma seção da usina. Trocar o dia recarrega a página nesse dia,
 * para que os campos e os rótulos mostrem o dia escolhido.
 */
export function SeletorDia({ valor }: { valor: string }) {
  const router = useRouter();
  return (
    <label className="field max-w-xs">
      Dia
      <input
        name="data"
        type="date"
        value={valor}
        className="h-11"
        onChange={(e) => {
          if (e.target.value && e.target.value !== valor) router.push(`/admin/usina?data=${e.target.value}`);
        }}
      />
    </label>
  );
}
