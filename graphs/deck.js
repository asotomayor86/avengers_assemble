// Datos de la baraja de ASSEMBLE! — sin dependencias de UI.
// Lo importan TANTO el servidor (repartir/validar) COMO el cliente (render).
// 81 cartas: 22 héroes + 20 poderes + 20 villanos + 5 aliados + 14 acciones.

export const CARD_DEFS = [
  { type: "hero", name: "Iron Man", color: "red", copies: 5 },
  { type: "hero", name: "Thor", color: "yellow", copies: 5 },
  { type: "hero", name: "Hulk", color: "green", copies: 5 },
  { type: "hero", name: "Capitán América", color: "blue", copies: 5 },
  { type: "hero", name: "Capitana Marvel", color: "multicolor", copies: 1 },
  { type: "hero", name: "Visión", color: "gray", intangible: true, copies: 1 },
  { type: "power", name: "Guante de Iron Man", color: "red", copies: 5 },
  { type: "power", name: "Mjölnir", color: "yellow", copies: 5 },
  { type: "power", name: "Puño de Hulk", color: "green", copies: 5 },
  { type: "power", name: "Escudo del Capitán América", color: "blue", copies: 5 },
  { type: "villain", name: "Ultron", color: "red", copies: 4 },
  { type: "villain", name: "Loki", color: "yellow", copies: 4 },
  { type: "villain", name: "Abominación", color: "green", copies: 4 },
  { type: "villain", name: "Barón Zemo", color: "blue", copies: 4 },
  { type: "villain", name: "Thanos", color: "multicolor", copies: 4 },
  { type: "ally", name: "Hawkeye", colors: ["yellow", "green"], copies: 1 },
  { type: "ally", name: "Bucky Barnes", colors: ["green", "blue"], copies: 1 },
  { type: "ally", name: "Falcon", colors: ["blue", "yellow"], copies: 1 },
  { type: "ally", name: "Black Panther", colors: ["blue", "red"], copies: 1 },
  { type: "ally", name: "Avispa", colors: ["yellow", "red"], copies: 1 },
  { type: "action", name: "Nick Furia", color: "purple", effect: "recruit", copies: 4 },
  { type: "action", name: "Doctor Strange", color: "purple", effect: "counter", copies: 4 },
  { type: "action", name: "Viuda Negra", color: "purple", effect: "spy", iconColor: "#D62828", copies: 4 },
  { type: "action", name: "Wanda", color: "purple", effect: "swap", iconColor: "#D62828", copies: 1 },
  { type: "action", name: "Guantelete de Thanos", color: "purple", effect: "snap",
    iconCount: 5, iconColors: ["#7F77DD", "#378ADD", "#E24B4A", "#BA7517", "#639922"], copies: 1 },
];

// Genera las 81 cartas con id único por copia.
// Cada carta lleva todos sus campos (incluido imageUrl: null) listos para enviar al cliente.
export function buildDeck() {
  const deck = [];
  for (const def of CARD_DEFS) {
    const { copies, ...rest } = def;
    const slug = def.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
    for (let i = 1; i <= copies; i++) deck.push({ ...rest, imageUrl: null, id: `${def.type}_${slug}_${i}` });
  }
  return deck; // length === 81
}
