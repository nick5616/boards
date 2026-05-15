import { uid } from "../utils/uid";

export const SEEDS = [
  {
    id: uid(),
    title: "Muay Thai",
    color: { h: 220, s: 50, l: 80 },
    iconData: "",
    stampId: "flame",
    layout: "bleed",
    blocks: [
      { id: uid(), type: "bigtitle", value: "Muay Thai" },
      { id: uid(), type: "text",     value: "Next class Friday 7pm." },
    ],
  },
  {
    id: uid(),
    title: "Singing Lessons",
    color: { h: 280, s: 40, l: 84 },
    iconData: "",
    stampId: "mic",
    layout: "bubble",
    blocks: [
      { id: uid(), type: "bigtitle", value: "Voice Notes" },
      { id: uid(), type: "text",     value: "Chest-to-mix transitions." },
    ],
  },
  {
    id: uid(),
    title: "Creative Dates",
    color: { h: 35, s: 60, l: 83 },
    iconData: "",
    stampId: "palette",
    layout: "bleed",
    blocks: [
      { id: uid(), type: "bigtitle", value: "The Artist's Way" },
      { id: uid(), type: "text",     value: "Morning pages — 12 days." },
    ],
  },
  {
    id: uid(),
    title: "Music Production",
    color: { h: 160, s: 45, l: 80 },
    iconData: "",
    stampId: "music",
    layout: "centered",
    blocks: [
      { id: uid(), type: "bigtitle", value: "In Progress" },
      { id: uid(), type: "text",     value: "45 projects. Keep rotating." },
    ],
  },
];
