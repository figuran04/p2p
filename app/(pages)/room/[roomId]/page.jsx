"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { rtcConfig } from "@/libs/webrtc";
import { generateRandomName } from "@/libs/randomName";
import QRCode from "react-qr-code";
import Link from "next/link";

export default function RoomPage() {
    const params = useParams();
    const roomId = params.roomId;

    const [mounted, setMounted] = useState(false);
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState("Idle");
    const [roomUsers, setRoomUsers] = useState([]);
    const [locked, setLocked] = useState(false);
    const [connected, setConnected] = useState(false);
    const [receivedFiles, setReceivedFiles] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [approved, setApproved] = useState(false);
    const [transfers, setTransfers] = useState([]);

    const peerRef = useRef(null);
    const dataChannelRef = useRef(null);
    const clientId = useRef(null);
    const incomingFileInfo = useRef(null);
    const incomingChunks = useRef([]);
    const fileInputRef = useRef(null);
    const deviceName = useRef(generateRandomName());

    const roomUrl =
        typeof window !== "undefined" ? window.location.href : "";

    // =====================================
    // INIT
    // =====================================

    useEffect(() => {
        setMounted(true);
        clientId.current = crypto.randomUUID();

        const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);

        ws.onopen = async () => {
            setStatus("Connected to signaling server");
            ws.send(JSON.stringify({ type: "join-room", roomId, name: deviceName.current }));

            const peer = new RTCPeerConnection(rtcConfig);
            peerRef.current = peer;

            peer.onconnectionstatechange = () => {
                setStatus(`P2P: ${peer.connectionState}`);
                if (peer.connectionState === "connected") setConnected(true);
            };

            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({ sender: clientId.current, type: "candidate", candidate: event.candidate }));
                }
            };

            peer.ondatachannel = (event) => setupDataChannel(event.channel);
            setSocket(ws);
        };

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "joined-as-host") { setIsHost(true); setApproved(true); setStatus("You are host"); return; }
            if (data.type === "join-request") { setPendingUsers((prev) => [...prev, { id: data.id, name: data.name }]); return; }
            if (data.type === "approved") { setApproved(true); setStatus("Approved by host"); return; }
            if (data.type === "rejected") { setStatus("Rejected by host"); return; }
            if (data.type === "room-locked") { setStatus("Room locked"); return; }
            if (data.type === "room-users") { setRoomUsers(data.users); setLocked(data.locked); return; }
            if (data.sender === clientId.current) return;

            const peer = peerRef.current;

            if (data.type === "offer") {
                if (peer.signalingState !== "stable") return;
                setStatus("Receiving offer...");
                await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                ws.send(JSON.stringify({ sender: clientId.current, type: "answer", answer }));
                return;
            }

            if (data.type === "answer") {
                if (peer.signalingState !== "have-local-offer") return;
                await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
                return;
            }

            if (data.type === "candidate") {
                try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); }
                catch (err) { console.error(err); }
            }
        };

        return () => ws.close();
    }, [roomId]);

    // =====================================
    // AUTO CONNECT
    // =====================================

    useEffect(() => {
        if (approved && isHost && roomUsers.length >= 2 && !connected) createConnection();
    }, [roomUsers, connected]);

    // =====================================
    // DATA CHANNEL
    // =====================================

    const setupDataChannel = (channel) => {
        dataChannelRef.current = channel;
        channel.binaryType = "arraybuffer";

        channel.onopen = () => { setStatus("P2P: connected"); setConnected(true); };

        channel.onmessage = (event) => {
            if (typeof event.data === "string") {
                const data = JSON.parse(event.data);

                if (data.type === "file-info") {
                    incomingFileInfo.current = data;
                    incomingChunks.current = [];
                    setMessages((prev) => [...prev, `Receiving ${data.name}`]);
                    setTransfers((prev) => [...prev, { id: data.fileId, name: data.name, size: data.size, progress: 0, type: "receiving", done: false, speed: "0 KB/s" }]);
                    return;
                }

                if (data.type === "file-end") {
                    const blob = new Blob(incomingChunks.current);
                    const url = URL.createObjectURL(blob);
                    setReceivedFiles((prev) => [...prev, { name: incomingFileInfo.current.name, url }]);
                    setTransfers((prev) => prev.map((item) => item.id === incomingFileInfo.current.fileId ? { ...item, progress: 100, done: true } : item));
                    setMessages((prev) => [...prev, `Received ${incomingFileInfo.current.name}`]);
                    incomingChunks.current = [];
                    return;
                }
            }

            incomingChunks.current.push(event.data);

            if (incomingFileInfo.current) {
                const receivedSize = incomingChunks.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                const progress = Math.floor((receivedSize / incomingFileInfo.current.size) * 100);
                setTransfers((prev) => prev.map((item) => item.id === incomingFileInfo.current.fileId ? { ...item, progress } : item));
            }
        };
    };

    const approveUser = (targetId) => {
        socket.send(JSON.stringify({ type: "approve-user", targetId }));
        setPendingUsers((prev) => prev.filter((user) => user.id !== targetId));
    };

    const rejectUser = (targetId) => {
        socket.send(JSON.stringify({ type: "reject-user", targetId }));
        setPendingUsers((prev) => prev.filter((user) => user.id !== targetId));
    };

    // =====================================
    // CREATE CONNECTION
    // =====================================

    const createConnection = async () => {
        const peer = peerRef.current;
        if (dataChannelRef.current) return;
        setStatus("Creating WebRTC connection...");
        const channel = peer.createDataChannel("file-transfer");
        setupDataChannel(channel);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ sender: clientId.current, type: "offer", offer }));
    };

    // =====================================
    // SEND FILE
    // =====================================

    const sendFile = async (file) => {
        const channel = dataChannelRef.current;
        if (!channel || channel.readyState !== "open") return;

        const chunkSize = 64 * 1024;
        const fileId = crypto.randomUUID();
        const startedAt = Date.now();

        setTransfers((prev) => [...prev, { id: fileId, name: file.name, size: file.size, progress: 0, type: "sending", done: false, speed: "0 KB/s" }]);
        channel.send(JSON.stringify({ type: "file-info", fileId, name: file.name, size: file.size }));

        let offset = 0;
        while (offset < file.size) {
            const slice = file.slice(offset, offset + chunkSize);
            const buffer = await slice.arrayBuffer();
            channel.send(buffer);
            offset += chunkSize;

            const progress = Math.floor((offset / file.size) * 100);
            const elapsed = (Date.now() - startedAt) / 1000;
            const speed = offset / elapsed;
            const speedText = speed > 1024 * 1024 ? `${(speed / 1024 / 1024).toFixed(2)} MB/s` : `${(speed / 1024).toFixed(2)} KB/s`;

            setTransfers((prev) => prev.map((item) => item.id === fileId ? { ...item, progress, speed: speedText } : item));
        }

        channel.send(JSON.stringify({ type: "file-end" }));
        setTransfers((prev) => prev.map((item) => item.id === fileId ? { ...item, progress: 100, done: true } : item));
        setMessages((prev) => [...prev, `Sent ${file.name}`]);
    };

    // =====================================
    // FILE HANDLERS
    // =====================================

    const handleDrop = async (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (!files.length) return;
        for (const file of files) await sendFile(file);
    };

    const handleFileSelect = async (event) => {
        const files = event.target.files;
        if (!files.length) return;
        for (const file of files) await sendFile(file);
        event.target.value = "";
    };

    if (!mounted) return null;

    // =====================================
    // AVATAR COLORS
    // =====================================

    const avatarColors = [
        "bg-blue-100 text-blue-800",
        "bg-orange-100 text-orange-800",
        "bg-teal-100 text-teal-800",
        "bg-purple-100 text-purple-800",
        "bg-rose-100 text-rose-800",
    ];

    const getInitials = (name) =>
        name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() ?? "??";

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
            <div className="max-w-6xl mx-auto space-y-3">

                {/* ── Wordmark ── */}
                <div className="flex flex-col items-center gap-2 mb-8 sm:mb-10">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black dark:bg-white rounded-2xl flex items-center justify-center">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
                        </svg>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-gray-900 dark:text-white">
                        <Link href="/">fiDrop</Link>
                    </h1>
                    <p className="text-sm text-gray-400">Seamless file sharing</p>
                </div>
                <div className="flex flex-col lg:flex-row lg:space-x-3 space-y-3">
                    <div className="space-y-3">
                        {/* ── Room Info ── */}
                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-4 sm:px-6 pt-5 pb-4">
                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500 mb-3">
                                    This session
                                </p>
                                <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                                    <div className="min-w-0">
                                        <p className="text-base sm:text-[17px] font-medium text-gray-900 dark:text-white truncate">
                                            {deviceName.current}
                                        </p>
                                        <p className="text-[12px] sm:text-[13px] font-mono text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
                                            room / {roomId}
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0 ${connected ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                                        {connected ? "P2P connected" : status}
                                    </span>
                                </div>
                            </div>

                            {/* QR / invite — hide when locked or connected */}
                            {!locked && !connected && (
                                <>
                                    <div className="h-px bg-gray-100 dark:bg-zinc-800" />

                                    {/* Mobile: stacked, Desktop: side-by-side */}
                                    <div className="px-4 sm:px-6 py-5 flex flex-col items-center gap-5 sm:gap-6">

                                        {/* QR Code — larger on all screens */}
                                        <div className="shrink-0 p-3 border border-gray-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950">
                                            <div className="w-40 h-40 sm:w-44 sm:h-44 md:w-56 md:h-56">
                                                <QRCode value={roomUrl} size={176} style={{
                                                    height: "auto",
                                                    maxWidth: "100%",
                                                    width: "100%",
                                                }} />
                                            </div>
                                        </div>

                                        {/* Invite info */}
                                        <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2 w-full">
                                            <p className="text-base font-medium text-gray-900 dark:text-white">Invite others</p>
                                            <p className="text-[13px] text-gray-400 dark:text-zinc-500 leading-relaxed">
                                                Scan the QR code or share the room link to let others join this session.
                                            </p>

                                            {/* Room URL chip */}
                                            <div className="mt-1 w-full sm:w-auto flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700">
                                                <p className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 truncate flex-1 min-w-0">
                                                    {roomUrl || `…/room/${roomId}`}
                                                </p>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(roomUrl)}
                                                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-lg text-[11px] font-medium text-gray-600 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-600 active:scale-95 transition-all"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Users in room */}
                            {roomUsers.length > 0 && (
                                <>
                                    <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                                    <div className="px-4 sm:px-6 py-4">
                                        <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500 mb-3">
                                            In this room
                                        </p>
                                        <div className="flex items-center flex-wrap gap-y-1">
                                            {roomUsers.map((user, i) => (
                                                <div
                                                    key={user.id ?? i}
                                                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[11px] sm:text-[12px] font-medium ${avatarColors[i % avatarColors.length]} ${i > 0 ? "-ml-2" : ""}`}
                                                    title={user.name}
                                                >
                                                    {getInitials(user.name)}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[13px] text-gray-400 dark:text-zinc-500 mt-2 truncate">
                                            {roomUsers.map((u) => u.name).join(", ")}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ── File Drop ── */}
                        {connected && (
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="px-4 sm:px-6 pt-5 pb-2">
                                    <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                        Send files
                                    </p>
                                </div>
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="mx-4 sm:mx-6 mb-5 border-[1.5px] border-dashed border-gray-200 dark:border-zinc-700 rounded-xl py-8 sm:py-10 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-[0.99] transition-all"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <svg className="w-7 h-7 text-gray-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                    <p className="text-sm sm:text-[15px] font-medium text-gray-700 dark:text-zinc-300">Drop files here</p>
                                    <p className="text-[13px] text-gray-400 hidden sm:block">or click to browse</p>
                                    <button className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-full text-[13px] font-medium hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        Choose files
                                    </button>
                                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full space-y-3">
                        {/* ── Join Requests ── */}
                        {isHost && pendingUsers.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="px-4 sm:px-6 pt-5 pb-2">
                                    <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                        Join request{pendingUsers.length > 1 ? "s" : ""}
                                    </p>
                                </div>
                                {pendingUsers.map((user, i) => (
                                    <div key={user.id}>
                                        {i > 0 && <div className="h-px bg-gray-100 dark:bg-zinc-800 mx-4 sm:mx-6" />}
                                        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[13px] font-medium text-gray-600 dark:text-zinc-300 shrink-0">
                                                {getInitials(user.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                                                <p className="text-[12px] text-gray-400">Wants to join</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => rejectUser(user.id)}
                                                    className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 rounded-full text-[12px] font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    onClick={() => approveUser(user.id)}
                                                    className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-full text-[12px] font-medium hover:bg-gray-700 dark:hover:bg-gray-200 active:scale-95 transition-all"
                                                >
                                                    Accept
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="h-3" />
                            </div>
                        )}

                        {/* ── Transfer Queue ── */}
                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-4 sm:px-6 pt-5 pb-3">
                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                    Transfer queue
                                </p>
                            </div>
                            {transfers.length === 0 ? (
                                <p className="px-4 sm:px-6 pb-5 text-[13px] text-gray-400 dark:text-zinc-600">No transfers yet.</p>
                            ) : (
                                transfers.map((item) => (
                                    <div key={item.id}>
                                        <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                                        <div className="px-4 sm:px-6 py-3.5 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 text-gray-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-0.5">
                                                    {item.done
                                                        ? (item.type === "sending" ? "Sent" : "Received")
                                                        : `${item.type === "sending" ? "Sending" : "Receiving"} · ${item.speed}`}
                                                </p>
                                                <div className="mt-1.5 h-[3px] bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${item.done ? "bg-green-500" : "bg-gray-900 dark:bg-white"}`}
                                                        style={{ width: `${item.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                            {item.done && (
                                                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── Received Files ── */}
                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-4 sm:px-6 pt-5 pb-3">
                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                    Received
                                </p>
                            </div>
                            {receivedFiles.length === 0 ? (
                                <p className="px-4 sm:px-6 pb-5 text-[13px] text-gray-400 dark:text-zinc-600">No files received yet.</p>
                            ) : (
                                receivedFiles.map((file, i) => (
                                    <div key={i}>
                                        <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                                        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950 flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                                            </div>
                                            <a
                                                href={file.url}
                                                download={file.name}
                                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-full text-[12px] font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-95 transition-all shrink-0"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                </svg>
                                                Save
                                            </a>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── Activity Log ── */}
                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-4 sm:px-6 pt-5 pb-3">
                                <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-zinc-500">
                                    Activity
                                </p>
                            </div>
                            {messages.length === 0 ? (
                                <p className="px-4 sm:px-6 pb-5 text-[13px] text-gray-400 dark:text-zinc-600">No activity yet.</p>
                            ) : (
                                [...messages].reverse().map((msg, i) => (
                                    <div key={i}>
                                        <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                                        <div className="px-4 sm:px-6 py-2.5 flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-600 shrink-0" />
                                            <p className="text-[13px] text-gray-500 dark:text-zinc-400 flex-1">{msg}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div className="h-2" />
                        </div>
                    </div>
                </div>

                {/* bottom safe area for mobile */}
                <div className="h-6 sm:h-2" />

            </div>

        </main>
    );
}
