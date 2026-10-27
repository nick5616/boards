import { useState } from "react";
import IconSettings from "./IconSettings";
import ApiKeys from "./ApiKeys";
import Diagnostics from "./Diagnostics";

const SECTIONS = [
  {
    id: "icons",
    label: "Icon Library",
    desc: "Customize how stamps look across your collections",
  },
  {
    id: "keys",
    label: "API keys",
    desc: "Free keys that unlock a few modules",
  },
  {
    id: "diag",
    label: "Diagnostics",
    desc: "How the outside sites are doing, and what broke",
  },
];

const isDesktop = () => window.matchMedia("(min-width: 680px)").matches;

export default function SettingsView({ cards, onBack }) {
  const [activeSection, setActiveSection] = useState(null);

  const effectiveSection = isDesktop()
    ? (activeSection ?? SECTIONS[0].id)
    : activeSection;

  const handleBack = () => {
    if (!isDesktop() && activeSection !== null) {
      setActiveSection(null);
    } else {
      onBack();
    }
  };

  const headerTitle =
    !isDesktop() && activeSection
      ? SECTIONS.find((s) => s.id === activeSection)?.label
      : "Settings";

  return (
    <div className="settings">
      <header className="settings-hdr">
        <button
          className="detail-back"
          onClick={handleBack}
          aria-label="Back"
        >
          ‹
        </button>
        <h1 className="settings-hdr-title">{headerTitle}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="settings-layout">
        <nav
          className={`settings-nav${activeSection ? " settings-nav-hidden" : ""}`}
          aria-label="Settings sections"
        >
          <div className="settings-nav-heading">Settings</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`settings-nav-item${effectiveSection === s.id ? " sel" : ""}`}
              onClick={() => setActiveSection(s.id)}
            >
              <div className="settings-nav-item-text">
                <span className="settings-nav-label">{s.label}</span>
                <span className="settings-nav-desc">{s.desc}</span>
              </div>
              <span className="settings-nav-arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </nav>

        <div
          className={`settings-content${!activeSection && !isDesktop() ? " settings-content-hidden" : ""}`}
        >
          {effectiveSection === "icons" && <IconSettings cards={cards} />}
          {effectiveSection === "keys" && <ApiKeys />}
          {effectiveSection === "diag" && <Diagnostics />}
          {!effectiveSection && (
            <div className="settings-content-empty">
              Select a section to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
