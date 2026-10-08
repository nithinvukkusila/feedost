import { brand } from "@/config/brand";

// Placeholder until the landing page (slice R0-1) replaces it.
export default function Home() {
  return (
    <main className="p-5">
      <h1 className="text-3xl font-extrabold">{brand.name}</h1>
    </main>
  );
}
