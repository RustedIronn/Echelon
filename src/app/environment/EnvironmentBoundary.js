import { Component } from "react";

// The decorative environment must never take the productivity application down. Without a boundary, a failed asset load
// inside the R3F Canvas is rethrown into the React root and unmounts every route. On failure this renders nothing, which
// leaves the static gradient (.landscape-environment__fallback) visible behind the app.
export default class EnvironmentBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
    this.reported = false;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (this.reported) return;
    this.reported = true;
    console.warn("[Echelon] The environment backdrop could not load; showing the static fallback instead.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
