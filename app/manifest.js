export default function manifest() {
  return {
    name: "fiDrop - Seamless File Sharing",
    short_name: "fiDrop",
    description:
      "Peer-to-peer file sharing application with WebRTC technology. Fast, secure, and private file transfers directly between devices.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    scope: "/",
    categories: ["productivity", "utilities", "file-transfer"],
    share_target: {
      action: "/",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "files",
            accept: ["image/*", "video/*", "audio/*", "application/*", "*/*"],
          },
        ],
      },
    },
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.jpeg",
        sizes: "995x812",
        type: "image/jpeg",
        form_factor: "wide",
        label: "fiDrop desktop interface",
      },
      {
        src: "/screenshot-mobile.png",
        sizes: "1920x2796",
        type: "image/png",
        form_factor: "narrow",
        label: "fiDrop mobile interface",
      },
    ],
    shortcuts: [
      {
        name: "Quick Share",
        short_name: "Share",
        description: "Quickly share files",
        url: "/?action=share",
        icons: [{ src: "/share-icon.png", sizes: "96x96" }],
      },
      {
        name: "Join Room",
        short_name: "Join",
        description: "Join existing room",
        url: "/join",
        icons: [{ src: "/join-icon.png", sizes: "96x96" }],
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
