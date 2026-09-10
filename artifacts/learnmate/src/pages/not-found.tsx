import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-9xl font-black text-primary/20">404</h1>
      <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h2>
      <p className="mt-2 text-muted-foreground">Sorry, we couldn't find the page you're looking for.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        Go back home
      </Link>
    </div>
  );
}
