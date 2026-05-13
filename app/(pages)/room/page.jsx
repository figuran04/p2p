"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import { useMemo, useState } from "react";

export default function RoomPage() {
    // =========================================================
    // MOCK STATE
    // =========================================================

    const isHost = true;

    const roomId = "ABCD123";
    const roomUrl = `https://fidrop.app/room/${roomId}`;

    const deviceName = "MacBook Pro";

    const roomUsers = [
        {
            id: "1",
            name: "MacBook Pro",
            role: "host",
            connected: true,
        },
        {
            id: "2",
            name: "Galaxy S24",
            role: "client",
            connected: true,
        },
        {
            id: "3",
            name: "iPad Air",
            role: "client",
            connected: true,
        },
        {
            id: "4",
            name: "ThinkPad",
            role: "client",
            connected: false,
        },
    ];

    const pendingUsers = [
        {
            id: "5",
            name: "Pixel 9",
        },
    ];

    const transfers = [
        {
            id: 1,
            name: "video.mp4",
            from: "MacBook Pro",
            to: "Galaxy S24",
            progress: 72,
            speed: "12 MB/s",
            done: false,
            type: "sending",
        },
        {
            id: 2,
            name: "presentation.pdf",
            from: "iPad Air",
            to: "MacBook Pro",
            progress: 100,
            speed: "Done",
            done: true,
            type: "received",
        },
    ];

    const receivedFiles = [
        {
            name: "design.fig",
            from: "Galaxy S24",
            url: "#",
        },
    ];

    const messages = [
        "[12:01] Galaxy S24 joined room",
        "[12:03] iPad Air joined room",
        "[12:05] video.mp4 sent to Galaxy S24",
    ];

    // =========================================================
    // TARGET SELECTION
    // =========================================================

    const clientUsers = useMemo(() => {
        return roomUsers.filter((u) => u.role === "client");
    }, [roomUsers]);

    const [selectedTargets, setSelectedTargets] = useState(["all"]);

    const toggleTarget = (id) => {
        if (id === "all") {
            setSelectedTargets(["all"]);
            return;
        }

        let next = selectedTargets.filter((t) => t !== "all");

        if (next.includes(id)) {
            next = next.filter((t) => t !== id);
        } else {
            next.push(id);
        }

        if (next.length === 0) {
            next = ["all"];
        }

        setSelectedTargets(next);
    };

    // =========================================================
    // HELPERS
    // =========================================================

    const avatarColors = [
        "bg-blue-100 text-blue-800",
        "bg-orange-100 text-orange-800",
        "bg-teal-100 text-teal-800",
        "bg-purple-100 text-purple-800",
        "bg-rose-100 text-rose-800",
    ];

    const getInitials = (name) =>
        name
            ?.split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() ?? "??";

    const connectedClients = roomUsers.filter(
        (u) => u.connected
    ).length;

    // =========================================================
    // UI
    // =========================================================

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

            <div className="max-w-6xl mx-auto space-y-3">

                {/* ========================================================= */}
                {/* HEADER */}
                {/* ========================================================= */}

                <div className="flex flex-col items-center gap-2 mb-8 sm:mb-10">

                    <div className="w-14 h-14 bg-black dark:bg-white rounded-2xl flex items-center justify-center">
                        <svg
                            className="w-7 h-7 text-white dark:text-black"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"
                            />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-medium tracking-tight text-gray-900 dark:text-white">
                        <Link href="/">fiDrop</Link>
                    </h1>

                    <p className="text-sm text-gray-400">
                        Seamless file sharing
                    </p>
                </div>

                {/* ========================================================= */}
                {/* GRID */}
                {/* ========================================================= */}

                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3">

                    {/* ========================================================= */}
                    {/* LEFT SIDE */}
                    {/* ========================================================= */}

                    <div className="space-y-3">

                        {/* ========================================================= */}
                        {/* ROOM CARD */}
                        {/* ========================================================= */}

                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">

                            <div className="px-5 pt-5 pb-4">

                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500 mb-3">
                                    Session
                                </p>

                                <div className="flex items-start justify-between gap-3">

                                    <div className="min-w-0">
                                        <p className="text-[17px] font-medium text-gray-900 dark:text-white truncate">
                                            {deviceName}
                                        </p>

                                        <p className="text-[13px] font-mono text-gray-400 dark:text-zinc-500 mt-0.5">
                                            room / {roomId}
                                        </p>
                                    </div>

                                    <div className="px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 text-[12px] font-medium whitespace-nowrap">
                                        {connectedClients} devices
                                    </div>
                                </div>
                            </div>

                            {/* ========================================================= */}
                            {/* QR */}
                            {/* ========================================================= */}

                            {isHost && (
                                <>
                                    <div className="h-px bg-gray-100 dark:bg-zinc-800" />

                                    <div className="px-5 py-5 flex flex-col items-center gap-5">

                                        <div className="p-3 border border-gray-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950">
                                            <QRCode
                                                value={roomUrl}
                                                size={220}
                                            />
                                        </div>

                                        <div className="text-center space-y-2">

                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                Invite devices
                                            </p>

                                            <p className="text-[13px] text-gray-400 dark:text-zinc-500">
                                                Scan the QR code or share the room link.
                                            </p>

                                            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700">

                                                <p className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 truncate">
                                                    {roomUrl}
                                                </p>

                                                <button
                                                    className="px-2.5 py-1 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-lg text-[11px] font-medium"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ========================================================= */}
                            {/* USERS */}
                            {/* ========================================================= */}

                            <div className="h-px bg-gray-100 dark:bg-zinc-800" />

                            <div className="px-5 py-4">

                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500 mb-3">
                                    Devices
                                </p>

                                <div className="space-y-2">

                                    {roomUsers.map((user, i) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-3"
                                        >

                                            <div
                                                className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-medium ${avatarColors[i % avatarColors.length]}`}
                                            >
                                                {getInitials(user.name)}
                                            </div>

                                            <div className="flex-1 min-w-0">

                                                <div className="flex items-center gap-2">

                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {user.name}
                                                    </p>

                                                    {user.role === "host" && (
                                                        <span className="px-1.5 py-0.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px]">
                                                            HOST
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[12px] text-gray-400">
                                                    {user.connected
                                                        ? "Connected"
                                                        : "Connecting..."}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ========================================================= */}
                        {/* JOIN REQUESTS */}
                        {/* ========================================================= */}

                        {isHost && pendingUsers.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">

                                <div className="px-5 pt-5 pb-3">
                                    <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                        Join requests
                                    </p>
                                </div>

                                {pendingUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        className="px-5 py-3 flex items-center gap-3"
                                    >

                                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[13px] font-medium">
                                            {getInitials(user.name)}
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {user.name}
                                            </p>

                                            <p className="text-[12px] text-gray-400">
                                                Wants to join
                                            </p>
                                        </div>

                                        <div className="flex gap-2">

                                            <button className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full text-[12px] font-medium">
                                                Decline
                                            </button>

                                            <button className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-[12px] font-medium">
                                                Accept
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ========================================================= */}
                    {/* RIGHT SIDE */}
                    {/* ========================================================= */}

                    <div className="space-y-3">

                        {/* ========================================================= */}
                        {/* SEND FILE */}
                        {/* ========================================================= */}

                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">

                            <div className="px-5 pt-5 pb-3">

                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                    Send files
                                </p>

                                {/* TARGETS */}

                                {isHost && (
                                    <div className="mt-4 flex flex-wrap gap-2">

                                        <button
                                            onClick={() => toggleTarget("all")}
                                            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                                                selectedTargets.includes("all")
                                                    ? "bg-black dark:bg-white text-white dark:text-black"
                                                    : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300"
                                            }`}
                                        >
                                            Everyone
                                        </button>

                                        {clientUsers.map((user) => (
                                            <button
                                                key={user.id}
                                                onClick={() => toggleTarget(user.id)}
                                                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                                                    selectedTargets.includes(user.id)
                                                        ? "bg-black dark:bg-white text-white dark:text-black"
                                                        : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300"
                                                }`}
                                            >
                                                {user.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* DROPZONE */}

                            <div className="px-5 pb-5">

                                <div className="border-[1.5px] border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl py-12 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all">

                                    <svg
                                        className="w-8 h-8 text-gray-300 dark:text-zinc-600"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                        />
                                    </svg>

                                    <p className="text-[15px] font-medium text-gray-700 dark:text-zinc-300">
                                        Drop files here
                                    </p>

                                    <p className="text-[13px] text-gray-400">
                                        or click to browse
                                    </p>

                                    <button className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-[13px] font-medium">
                                        Choose files
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ========================================================= */}
                        {/* TRANSFERS */}
                        {/* ========================================================= */}

                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">

                            <div className="px-5 pt-5 pb-3">
                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                    Transfer queue
                                </p>
                            </div>

                            {transfers.map((item) => (
                                <div
                                    key={item.id}
                                    className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800"
                                >

                                    <div className="flex items-start gap-3">

                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 shrink-0" />

                                        <div className="flex-1 min-w-0">

                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {item.name}
                                            </p>

                                            <p className="text-[12px] text-gray-400 mt-1">
                                                {item.from} → {item.to}
                                            </p>

                                            <p className="text-[12px] text-gray-400 mt-0.5">
                                                {item.done
                                                    ? "Completed"
                                                    : `${item.progress}% · ${item.speed}`}
                                            </p>

                                            <div className="mt-2 h-[4px] rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">

                                                <div
                                                    className={`h-full rounded-full ${
                                                        item.done
                                                            ? "bg-green-500"
                                                            : "bg-black dark:bg-white"
                                                    }`}
                                                    style={{
                                                        width: `${item.progress}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ========================================================= */}
                        {/* RECEIVED */}
                        {/* ========================================================= */}

                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">

                            <div className="px-5 pt-5 pb-3">
                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                    Received
                                </p>
                            </div>

                            {receivedFiles.map((file, i) => (
                                <div
                                    key={i}
                                    className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3"
                                >

                                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950 shrink-0" />

                                    <div className="flex-1 min-w-0">

                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {file.name}
                                        </p>

                                        <p className="text-[12px] text-gray-400 mt-0.5">
                                            Received from {file.from}
                                        </p>
                                    </div>

                                    <button className="px-3 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-full text-[12px] font-medium">
                                        Save
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
