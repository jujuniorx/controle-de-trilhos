// tests/unit/ui-field.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Field, Input } from '@/components/ui/Input';

describe('Field + Input', () => {
  afterEach(cleanup);

  it('associa o label ao input via htmlFor/id', () => {
    render(
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" />
      </Field>,
    );
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('name', 'email');
  });

  it('mostra a mensagem de erro com role="alert" quando error é informado', () => {
    render(
      <Field label="E-mail" htmlFor="email" error="E-mail obrigatório">
        <Input id="email" name="email" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail obrigatório');
  });

  it('não renderiza nenhum role="alert" quando não há erro', () => {
    render(
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" />
      </Field>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
