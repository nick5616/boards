import { Component } from "react";
import { MODULES } from "../../constants/modules";
import { record } from "../../lib/telemetry";

// If one module trips over its own feet, it says so on its own card instead of
// taking the whole board down with it. "Try again" re-mounts it.
export default class ModuleCatch extends Component {
  state = { err: null };

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error(`module "${this.props.type}" crashed:`, err, info?.componentStack);
    record("crash", { type: this.props.type, msg: String(err?.message ?? err).slice(0, 300) });
  }

  componentDidUpdate(prev) {
    // a different module in the same slot gets a fresh start
    if (prev.type !== this.props.type && this.state.err) this.setState({ err: null });
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="mod-crashed" role="alert">
        <b>The {MODULES[this.props.type]?.label ?? "module"} came unstuck.</b>
        <span>{String(this.state.err?.message ?? this.state.err).slice(0, 140)}</span>
        <button onClick={() => this.setState({ err: null })}>Try again</button>
      </div>
    );
  }
}
