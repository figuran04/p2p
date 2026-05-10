const adjectives = [
  "Blue",
  "Silver",
  "Neon",
  "Green",
  "Red",
  "Golden",
  "Shadow",
];

const animals = ["Tiger", "Panda", "Wolf", "Fox", "Eagle", "Falcon", "Bear"];

export function generateRandomName() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

  const animal = animals[Math.floor(Math.random() * animals.length)];

  return `${adjective} ${animal}`;
}
