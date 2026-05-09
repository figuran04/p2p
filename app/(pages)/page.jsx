"use client";

import { useEffect, useState } from "react";

export default function HomePage() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onopen = () => {
      console.log("Connected to signaling server");
    };

    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    ws.onclose = () => {
      console.log("Disconnected");
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send("Hello realtime!");
    }
  };

  return (
    <div>
      <section className="flex justify-center items-center w-full px-6 min-h-screen text-gray-50 bg-gray-950">
        <div className="text-center -mt-40 space-y-6">
          <h1 className="text-4xl font-bold">
            WebRTC File Transfer
          </h1>

          <p>
            Testing WebSocket Signaling Connection
          </p>

          <button
            onClick={sendMessage}
            className="text-gray-50 bg-orange-500 py-3 px-5 rounded-lg cursor-pointer"
          >
            Send Message
          </button>

          <div className="mt-6 space-y-2">
            {messages.map((msg, index) => (
              <div
                key={index}
                className="bg-gray-800 px-4 py-2 rounded-lg"
              >
                {msg}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}