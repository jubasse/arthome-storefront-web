import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dataResponse, errorResponse, requestBody, viewerContext } from '@/test/bff-double';

import { SignInForm } from './sign-in-form';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const established = { mode: 'cookie', viewerContext: viewerContext() };

function stubFetch(answer: () => Response) {
  const fetchDouble = vi.fn((..._args: [string, RequestInit]) => Promise.resolve(answer()));
  vi.stubGlobal('fetch', fetchDouble);
  return fetchDouble;
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.fr' } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret-pass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
}

afterEach(() => {
  cleanup();
  replace.mockClear();
  vi.unstubAllGlobals();
});

describe('SignInForm', () => {
  it('signs in by cookie with the surface header', async () => {
    const fetchDouble = stubFetch(() => dataResponse(established));

    render(<SignInForm returnPath={null} />);
    fillAndSubmit();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const [url, init] = fetchDouble.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/auth/sign-in');
    expect(requestBody(init)).toEqual({ email: 'a@b.fr', password: 'secret-pass', mode: 'cookie' });
    expect(new Headers(init?.headers).get('x-arthome-surface')).toBe('storefront_web');
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('returns to a relative path', async () => {
    stubFetch(() => dataResponse(established));

    render(<SignInForm returnPath="/live/abc" />);
    fillAndSubmit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/live/abc'));
  });

  it('never follows an absolute return path', async () => {
    stubFetch(() => dataResponse(established));

    render(<SignInForm returnPath="https://evil.example/" />);
    fillAndSubmit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('shows the message of a refusal code', async () => {
    stubFetch(() => errorResponse(401, 'identity.invalid_credentials'));

    render(<SignInForm returnPath={null} />);
    fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toBe('Email ou mot de passe incorrect.');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>('Mot de passe').value).toBe('');
  });
});
