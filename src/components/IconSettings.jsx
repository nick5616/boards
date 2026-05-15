import { useState } from "react";
import { STAMPS } from "../constants/stamps";
import { useIconOverrides } from "../contexts/IconOverridesContext";
import StampSVG from "./StampSVG";
import DrawCanvas from "./DrawCanvas";

export default function IconSettings({ cards }) {
  const { overrides, setOverride, clearOverride } = useIconOverrides();
  const [editing, setEditing] = useState(null);
  const [editTab, setEditTab] = useState("original");
  const [pendingUpload, setPendingUpload] = useState("");
  const [pendingDraw, setPendingDraw] = useState("");

  const openEditor = (stampId) => {
    const ov = overrides[stampId];
    setEditing(stampId);
    if (ov?.type === "upload") {
      setEditTab("upload");
      setPendingUpload(ov.data);
      setPendingDraw("");
    } else if (ov?.type === "draw") {
      setEditTab("draw");
      setPendingDraw(ov.data);
      setPendingUpload("");
    } else {
      setEditTab("original");
      setPendingUpload("");
      setPendingDraw("");
    }
  };

  const closeEditor = () => {
    setEditing(null);
    setPendingUpload("");
    setPendingDraw("");
  };

  const handleSave = () => {
    if (!editing) return;
    if (editTab === "original") {
      clearOverride(editing);
    } else if (editTab === "upload" && pendingUpload) {
      setOverride(editing, { type: "upload", data: pendingUpload });
    } else if (editTab === "draw" && pendingDraw) {
      setOverride(editing, { type: "draw", data: pendingDraw });
    }
    closeEditor();
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPendingUpload(ev.target.result);
    reader.readAsDataURL(file);
  };

  const getCardCount = (stampId) =>
    cards.filter((c) => c.stampId === stampId).length;

  const getCardTitles = (stampId) =>
    cards.filter((c) => c.stampId === stampId).map((c) => c.title);

  const editingStamp = STAMPS.find((s) => s.id === editing);
  const hasExistingOverride = editing && !!overrides[editing];

  const canSave =
    editTab === "original" ||
    (editTab === "upload" && !!pendingUpload) ||
    (editTab === "draw" && !!pendingDraw);

  return (
    <div className="icon-settings">
      <p className="icon-settings-intro">
        Replace any stamp with your own image or drawing. Changes apply everywhere that stamp is used.
      </p>

      <div className="icon-grid">
        {STAMPS.map((st) => {
          const count = getCardCount(st.id);
          const hasOv = !!overrides[st.id];
          return (
            <button
              key={st.id}
              className={`icon-tile${hasOv ? " customized" : ""}`}
              onClick={() => openEditor(st.id)}
              aria-label={`Customize ${st.id} stamp`}
            >
              {hasOv && <span className="icon-tile-dot" aria-hidden="true" />}
              {count > 0 && (
                <span className="icon-tile-badge" aria-label={`${count} cards`}>
                  {count}
                </span>
              )}
              <div className="icon-tile-preview">
                <StampSVG stampId={st.id} color="#2a2520" />
              </div>
              <div className="icon-tile-name">{st.id}</div>
            </button>
          );
        })}
      </div>

      {editing && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Customize ${editing} stamp`}
          >
            <div className="modal-topbar">
              <div className="modal-handle" />
              <div className="modal-title">{editing}</div>
              <button className="modal-x" onClick={closeEditor} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="icon-editor-meta">
                <div className="icon-editor-preview-wrap">
                  <StampSVG stampId={editing} color="#2a2520" />
                </div>
                <p className="icon-usage-note">
                  {getCardTitles(editing).length > 0
                    ? `Used in: ${getCardTitles(editing).join(", ")}`
                    : "Not used in any collection yet"}
                </p>
              </div>

              <div className="draw-tabs">
                <button
                  className={`draw-tab${editTab === "original" ? " sel" : ""}`}
                  onClick={() => setEditTab("original")}
                >
                  Original
                </button>
                <button
                  className={`draw-tab${editTab === "upload" ? " sel" : ""}`}
                  onClick={() => setEditTab("upload")}
                >
                  Upload image
                </button>
                <button
                  className={`draw-tab${editTab === "draw" ? " sel" : ""}`}
                  onClick={() => setEditTab("draw")}
                >
                  Draw
                </button>
              </div>

              {editTab === "original" && (
                <div className="icon-tab-original">
                  <div className="icon-original-preview">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2a2520"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={editingStamp?.path} />
                    </svg>
                  </div>
                  <p className="icon-original-desc">
                    {hasExistingOverride
                      ? "Save to revert this stamp back to its original built-in design."
                      : "This stamp is already using its built-in design."}
                  </p>
                </div>
              )}

              {editTab === "upload" && (
                <div className="icon-tab-upload">
                  <label className="icon-upload-area">
                    {pendingUpload ? (
                      <img
                        src={pendingUpload}
                        alt="Preview"
                        className="icon-upload-preview"
                      />
                    ) : (
                      <div className="icon-upload-placeholder">
                        <span className="icon-upload-arrow">↑</span>
                        <span>Tap to choose an image</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                  {pendingUpload && (
                    <button
                      className="draw-clear"
                      style={{ marginTop: 8, display: "block" }}
                      onClick={() => setPendingUpload("")}
                    >
                      Remove image
                    </button>
                  )}
                </div>
              )}

              {editTab === "draw" && (
                <DrawCanvas
                  value={pendingDraw}
                  onChange={setPendingDraw}
                  bgColor="#fff"
                />
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeEditor}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={!canSave}
              >
                {editTab === "original"
                  ? hasExistingOverride
                    ? "Revert to original"
                    : "Done"
                  : "Save custom icon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
