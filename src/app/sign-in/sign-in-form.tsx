'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { SessionMode } from '@arthome/contracts/identity';

import { refusalMessage } from '@/lib/refusal-messages';
import { safeReturnPath } from '@/lib/return-path';
import { SCHEMA_MISMATCH_CODE, errorCodeOf, guarded, storefront } from '@/lib/storefront-client';

interface SignInFormProps {
  readonly returnPath: string | null;
}

function textField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function SignInForm({ returnPath }: SignInFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = textField(data, 'email');
    const password = textField(data, 'password');
    form.reset();
    setPending(true);
    setMessage(null);
    const answer = await guarded(() =>
      storefront.signIn({ body: { email, password, mode: SessionMode.COOKIE } }),
    );
    setPending(false);
    if (answer !== 'unreachable' && answer.status === 200) {
      router.replace(safeReturnPath(returnPath));
      return;
    }
    setMessage(
      refusalMessage(answer === 'unreachable' ? SCHEMA_MISMATCH_CODE : errorCodeOf(answer)),
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={pending}>
        Se connecter
      </button>
      {message !== null && <p role="alert">{message}</p>}
    </form>
  );
}
