import { SignInForm } from './sign-in-form';

interface SignInPageProps {
  readonly searchParams: Promise<{ readonly returnPath?: string | string[] }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { returnPath } = await searchParams;
  return (
    <main>
      <h1>Connexion</h1>
      <SignInForm returnPath={typeof returnPath === 'string' ? returnPath : null} />
    </main>
  );
}
