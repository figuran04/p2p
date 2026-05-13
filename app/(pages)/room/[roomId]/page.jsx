


"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";

import { rtcConfig } from "@/libs/webrtc";
import { generateRandomName } from "@/libs/randomName";

export default function RoomPage() {

    // ============================================================
    // PARAMS
    // ============================================================

    const params = useParams();

    const roomId = params.roomId;

    const roomUrl =
        typeof window !== "undefined"
            ? window.location.href
            : "";

    // ============================================================
    // HELPERS
    // ============================================================

    const avatarColors = [
        "bg-blue-100 text-blue-700",
        "bg-orange-100 text-orange-700",
        "bg-purple-100 text-purple-700",
        "bg-emerald-100 text-emerald-700",
        "bg-rose-100 text-rose-700",
    ];

    const getInitials = (name = "") => {
        return name
            .split(" ")
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
    };

    const log = (msg) => {
        setMessages((prev) => [
            `[${new Date().toLocaleTimeString()}] ${msg}`,
            ...prev,
        ]);
    };

    // ============================================================
    // REFS
    // ============================================================

    const wsRef = useRef(null);

    const peersRef = useRef({});

    const channelsRef = useRef({});

    const fileInputRef = useRef(null);

    const deviceName = useRef(generateRandomName());

    // ============================================================
    // STATES
    // ============================================================

    const [myId, setMyId] = useState(null);

    const [isHost, setIsHost] = useState(false);

    const [status, setStatus] = useState("Connecting...");

    const [roomUsers, setRoomUsers] = useState([]);

    const [pendingUsers, setPendingUsers] = useState([]);

    const [messages, setMessages] = useState([]);

    const [receivedFiles, setReceivedFiles] = useState([]);

    const [transfers, setTransfers] = useState([]);

    const [selectedTargets, setSelectedTargets] = useState(["all"]);

    // ============================================================
    // MEMO
    // ============================================================

    const clientUsers = useMemo(() => {
        return roomUsers.filter((u) => u.role === "client");
    }, [roomUsers]);

    // ============================================================
    // WS CONNECT
    // ============================================================

    useEffect(() => {

        const ws = new WebSocket(
            process.env.NEXT_PUBLIC_WS_URL
        );

        wsRef.current = ws;

        ws.onopen = () => {

            setStatus("Connected");

            ws.send(
                JSON.stringify({
                    type: "join-room",
                    roomId,
                    name: deviceName.current,
                })
            );
        };

        ws.onmessage = async (event) => {

            const data = JSON.parse(event.data);

            // HOST
            if (data.type === "joined-as-host") {

                setMyId(data.id);

                setIsHost(true);

                log("You created the room");

                return;
            }

            // APPROVED
            if (data.type === "approved") {

                setMyId(data.id);

                log("You joined the room");

                return;
            }

            // JOIN REQUEST
            if (data.type === "join-request") {

                setPendingUsers((prev) => [
                    ...prev,
                    {
                        id: data.id,
                        name: data.name,
                    },
                ]);

                log(`${data.name} wants to join`);

                return;
            }

            // USERS
            if (data.type === "room-users") {

                setRoomUsers(data.users);

                return;
            }

            // SIGNAL
            if (data.type === "signal") {

                await handleSignal(data);

                return;
            }

            // ROOM CLOSED
            if (data.type === "room-closed") {

                alert("Room closed");

                return;
            }
        };

        ws.onclose = () => {
            setStatus("Disconnected");
        };

        return () => {

            ws.close();

            Object.values(peersRef.current).forEach(
                (peer) => peer.close()
            );
        };

    }, []);

    // ============================================================
    // PEER
    // ============================================================

    const createPeer = (targetId) => {

        const peer = new RTCPeerConnection(rtcConfig);

        peersRef.current[targetId] = peer;

        peer.onicecandidate = (event) => {

            if (!event.candidate) return;

            wsRef.current.send(
                JSON.stringify({
                    type: "signal",
                    targetId,
                    payload: {
                        type: "ice",
                        candidate: event.candidate,
                    },
                })
            );
        };

        peer.ondatachannel = (event) => {

            const channel = event.channel;

            setupDataChannel(channel, targetId);
        };

        return peer;
    };

    // ============================================================
    // DATA CHANNEL
    // ============================================================

    const setupDataChannel = (channel, peerId) => {

        channelsRef.current[peerId] = channel;

        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
            log(`Connected to ${peerId}`);
        };

        channel.onclose = () => {
            log(`Disconnected from ${peerId}`);
        };

        channel.onmessage = async (event) => {

            // METADATA
            if (typeof event.data === "string") {

                const data = JSON.parse(event.data);

                if (data.type === "file-meta") {

                    channelsRef.current[peerId]._incomingFile = {
                        name: data.name,
                        size: data.size,
                        type: data.mime,
                        buffers: [],
                    };
                }

                return;
            }

            // BINARY
            const fileData =
                channelsRef.current[peerId]._incomingFile;

            if (!fileData) return;

            fileData.buffers.push(event.data);

            const receivedSize =
                fileData.buffers.reduce(
                    (acc, b) => acc + b.byteLength,
                    0
                );

            // COMPLETE
            if (receivedSize >= fileData.size) {

                const blob = new Blob(fileData.buffers, {
                    type: fileData.type,
                });

                const url = URL.createObjectURL(blob);

                setReceivedFiles((prev) => [
                    ...prev,
                    {
                        name: fileData.name,
                        url,
                    },
                ]);

                log(`${fileData.name} received`);

                delete channelsRef.current[peerId]._incomingFile;
            }
        };
    };

    // ============================================================
    // SIGNAL
    // ============================================================

    const handleSignal = async (data) => {

        const fromId = data.fromId;

        let peer = peersRef.current[fromId];

        if (!peer) {
            peer = createPeer(fromId);
        }

        const payload = data.payload;

        // OFFER
        if (payload.type === "offer") {

            await peer.setRemoteDescription(
                new RTCSessionDescription(payload.offer)
            );

            const answer = await peer.createAnswer();

            await peer.setLocalDescription(answer);

            wsRef.current.send(
                JSON.stringify({
                    type: "signal",
                    targetId: fromId,
                    payload: {
                        type: "answer",
                        answer,
                    },
                })
            );

            return;
        }

        // ANSWER
        if (payload.type === "answer") {

            await peer.setRemoteDescription(
                new RTCSessionDescription(payload.answer)
            );

            return;
        }

        // ICE
        if (payload.type === "ice") {

            await peer.addIceCandidate(
                new RTCIceCandidate(payload.candidate)
            );

            return;
        }
    };

    // ============================================================
    // CONNECT PEER
    // ============================================================

    const connectToPeer = async (targetId) => {

        const peer = createPeer(targetId);

        const channel = peer.createDataChannel("file");

        setupDataChannel(channel, targetId);

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        wsRef.current.send(
            JSON.stringify({
                type: "signal",
                targetId,
                payload: {
                    type: "offer",
                    offer,
                },
            })
        );
    };

    // ============================================================
    // APPROVE
    // ============================================================

    const approveUser = async (targetId) => {

        wsRef.current.send(
            JSON.stringify({
                type: "approve-user",
                targetId,
            })
        );

        setPendingUsers((prev) =>
            prev.filter((u) => u.id !== targetId)
        );

        await connectToPeer(targetId);

        log(`Approved user`);
    };

    // ============================================================
    // REJECT
    // ============================================================

    const rejectUser = (targetId) => {

        wsRef.current.send(
            JSON.stringify({
                type: "reject-user",
                targetId,
            })
        );

        setPendingUsers((prev) =>
            prev.filter((u) => u.id !== targetId)
        );
    };

    // ============================================================
    // SEND FILES
    // ============================================================

    const sendFiles = async (files) => {

        const targets =
            selectedTargets.includes("all")
                ? clientUsers.map((u) => u.id)
                : selectedTargets;

        for (const targetId of targets) {

            const channel = channelsRef.current[targetId];

            if (!channel) continue;

            for (const file of files) {

                channel.send(
                    JSON.stringify({
                        type: "file-meta",
                        name: file.name,
                        size: file.size,
                        mime: file.type,
                    })
                );

                const chunkSize = 64 * 1024;

                let offset = 0;

                while (offset < file.size) {

                    const slice = file.slice(
                        offset,
                        offset + chunkSize
                    );

                    const buffer =
                        await slice.arrayBuffer();

                    channel.send(buffer);

                    offset += chunkSize;

                    const progress = Math.floor(
                        (offset / file.size) * 100
                    );

                    setTransfers((prev) => {

                        const exists = prev.find(
                            (t) =>
                                t.id ===
                                `${targetId}-${file.name}`
                        );

                        if (exists) {

                            return prev.map((t) =>
                                t.id ===
                                    `${targetId}-${file.name}`
                                    ? {
                                        ...t,
                                        progress,
                                        done:
                                            progress === 100,
                                    }
                                    : t
                            );
                        }

                        return [
                            ...prev,
                            {
                                id: `${targetId}-${file.name}`,
                                name: file.name,
                                from: deviceName.current,
                                to: targetId,
                                progress,
                                speed: "Sending...",
                                done: false,
                            },
                        ];
                    });
                }

                log(`${file.name} sent`);
            }
        }
    };

    // ============================================================
    // FILE SELECT
    // ============================================================

    const handleFileSelect = async (e) => {

        const files = Array.from(e.target.files);

        await sendFiles(files);
    };

    // ============================================================
    // UI
    // ============================================================

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-zinc-950">

            <div className="max-w-7xl mx-auto p-4 lg:p-6">

                {/* TOPBAR */}

                <div className="mb-4 flex items-center justify-between">

                    <div className="flex items-center gap-3">

                        <div className="w-11 h-11 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
                            <svg
                                className="w-5 h-5 text-white dark:text-black"
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

                        <div>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                                fiDrop
                            </h1>

                            <p className="text-xs text-gray-400">
                                Seamless multi-device transfer
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">

                        <div className="px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 text-xs font-medium">
                            {roomUsers.length} connected
                        </div>

                        <div className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs font-mono">
                            {roomId}
                        </div>
                    </div>
                </div>

                {/* GRID */}

                <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">

                    {/* SIDEBAR */}

                    <div className="space-y-4">

                        {/* SESSION */}

                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

                            <div className="p-5">

                                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-4">
                                    This device
                                </p>

                                <div className="flex items-center gap-3">

                                    <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
                                        {getInitials(deviceName.current)}
                                    </div>

                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {deviceName.current}
                                        </p>

                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {isHost
                                                ? "Host device"
                                                : "Connected client"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {isHost && (
                                <>
                                    <div className="h-px bg-gray-100 dark:bg-zinc-800" />

                                    <div className="p-5 flex flex-col items-center gap-4">

                                        <div className="bg-white p-3 rounded-3xl border border-gray-100">
                                            <QRCode
                                                value={roomUrl}
                                                size={210}
                                            />
                                        </div>

                                        <button
                                            onClick={() =>
                                                navigator.clipboard.writeText(
                                                    roomUrl
                                                )
                                            }
                                            className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-sm font-medium"
                                        >
                                            Copy invite link
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* JOIN REQUEST */}

                        {isHost &&
                            pendingUsers.length > 0 && (

                                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

                                    <div className="px-5 pt-5 pb-4">

                                        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
                                            Join Requests
                                        </p>
                                    </div>

                                    <div className="px-3 pb-3 space-y-2">

                                        {pendingUsers.map((user) => (

                                            <div
                                                key={user.id}
                                                className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800"
                                            >

                                                <p className="font-medium text-sm">
                                                    {user.name}
                                                </p>

                                                <div className="flex gap-2 mt-3">

                                                    <button
                                                        onClick={() =>
                                                            rejectUser(user.id)
                                                        }
                                                        className="flex-1 px-3 py-2 rounded-xl bg-gray-200 text-sm"
                                                    >
                                                        Reject
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            approveUser(user.id)
                                                        }
                                                        className="flex-1 px-3 py-2 rounded-xl bg-black text-white text-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* DEVICES */}

                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

                            <div className="px-5 pt-5 pb-4">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
                                    Devices
                                </p>
                            </div>

                            <div className="px-3 pb-3 space-y-1">

                                {roomUsers.map((user, i) => (

                                    <button
                                        key={user.id}
                                        onClick={() =>
                                            setSelectedTargets([user.id])
                                        }
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selectedTargets.includes(user.id)
                                                ? "bg-black text-white"
                                                : "hover:bg-gray-50 dark:hover:bg-zinc-800"
                                            }`}
                                    >

                                        <div
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-semibold ${selectedTargets.includes(user.id)
                                                    ? "bg-white/10"
                                                    : avatarColors[
                                                    i %
                                                    avatarColors.length
                                                    ]
                                                }`}
                                        >
                                            {getInitials(user.name)}
                                        </div>

                                        <div className="flex-1 text-left min-w-0">

                                            <div className="flex items-center gap-2">

                                                <p className="text-sm font-medium truncate">
                                                    {user.name}
                                                </p>

                                                {user.role === "host" && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px]">
                                                        HOST
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-[11px] opacity-70 mt-1">
                                                Online
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CONTENT */}

                    <div className="space-y-4">

                        {/* DROPZONE */}

                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

                            <div
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                                className="p-10 lg:p-16"
                            >

                                <div className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-[2rem] p-10 lg:p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all">

                                    <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-5">

                                        <svg
                                            className="w-10 h-10 text-gray-400"
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
                                    </div>

                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        Drop files here
                                    </h2>

                                    <p className="mt-2 text-sm text-gray-400">
                                        Drag & drop files to transfer instantly
                                    </p>

                                    <button className="mt-6 px-5 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium">
                                        Browse files
                                    </button>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>

                        {/* TRANSFERS */}

                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

                            <div className="px-5 pt-5 pb-4 flex items-center justify-between">

                                <div>

                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        Transfer Queue
                                    </p>

                                    <p className="text-xs text-gray-400 mt-1">
                                        Active transfers
                                    </p>
                                </div>

                                <div className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs">
                                    {transfers.length} items
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">

                                {transfers.length === 0 && (
                                    <p className="p-5 text-sm text-gray-400">
                                        No transfers yet.
                                    </p>
                                )}

                                {transfers.map((item) => (

                                    <div
                                        key={item.id}
                                        className="p-5"
                                    >

                                        <div className="flex items-start gap-4">

                                            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">

                                                <svg
                                                    className="w-6 h-6 text-gray-400"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={1.5}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25"
                                                    />
                                                </svg>
                                            </div>

                                            <div className="flex-1">

                                                <div className="flex items-center justify-between gap-4">

                                                    <div>

                                                        <p className="text-sm font-medium">
                                                            {item.name}
                                                        </p>

                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {item.from} →{" "}
                                                            {item.to}
                                                        </p>
                                                    </div>

                                                    <p className="text-sm font-medium">
                                                        {item.progress}%
                                                    </p>
                                                </div>

                                                <div className="mt-4 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">

                                                    <div
                                                        className={`h-full rounded-full transition-all ${item.done
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
                        </div>

                        {/* RECEIVED */}

                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

                            <div className="px-5 pt-5 pb-4">

                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Received Files
                                </p>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">

                                {receivedFiles.length === 0 && (
                                    <p className="p-5 text-sm text-gray-400">
                                        No files received yet.
                                    </p>
                                )}

                                {receivedFiles.map((file, i) => (

                                    <div
                                        key={i}
                                        className="p-5 flex items-center justify-between"
                                    >

                                        <div>

                                            <p className="text-sm font-medium">
                                                {file.name}
                                            </p>

                                            <p className="text-xs text-gray-400 mt-1">
                                                Ready to download
                                            </p>
                                        </div>

                                        <a
                                            href={file.url}
                                            download={file.name}
                                            className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium"
                                        >
                                            Save
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
