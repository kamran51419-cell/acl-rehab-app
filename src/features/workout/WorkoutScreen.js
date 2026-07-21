import React from "react";
import WorkoutScreen from "./WorkoutScreen.jsx";

export * from "./WorkoutScreen.jsx";

export default function WorkoutScreenWithStableDiscardNavigation(props) {
  return React.createElement(WorkoutScreen, {
    ...props,
    onDiscarded: () => {},
  });
}
