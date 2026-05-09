"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        const roomId = crypto.randomUUID();

        router.replace(`/room/${roomId}`);
    }, [router]);

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
            <p>Creating session...</p>
        </main>
    );
}
