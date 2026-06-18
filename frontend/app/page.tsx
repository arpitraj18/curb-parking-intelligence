"use client";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <section className="view" style={{ display: "grid", placeItems: "center", color: "var(--muted)" }}>
      Loading map…
    </section>
  ),
});

export default function Page() {
  return <MapView />;
}
