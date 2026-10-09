import { brand } from "@/config/brand";

// Placeholder until the landing page (slice R0-1) replaces it.
export default function Home() {
  return (
    <main className="p-5">
      <h1 className="type-headline text-3xl">{brand.name}</h1>
    </main>
  );
}
