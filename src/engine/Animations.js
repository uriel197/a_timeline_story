export class Animation {
  constructor(canvas) {
    this.canvas = canvas;
  }

  zoomIntoSegment(index, timeline) {
    const { min, max } = timeline.camera.target;
    const segmentWidth = (max - min) / (timeline.data.points - 1);

    const newMin = min + index * segmentWidth;
    const newMax = min + (index + 1) * segmentWidth;

    // --- THE SNAPSHOT ---
    timeline.levelHistory.push({
      level: timeline.currentLevel,
      data: { ...timeline.data }, // Clone the current data object
      viewState: "OVERVIEW", // If we go back, we want to land in the overview of THIS level
      cameraTarget: { min, max }, // Where the camera was before zooming in
      focusTarget: { min: newMin, max: newMax }, // The "doorway" we are currently in
      index,
    });

    timeline.camera.setTarget(newMin, newMax);
    timeline.viewState = "FOCUS";
    // Store info for the Div and the next zoom step
    timeline.focusedSegment = { index, min: newMin, max: newMax };

    // Signal the UI to show the Div (we'll handle timeline signal next)
    timeline.onFocusReached?.(timeline.focusedSegment);
  }

  stepBack(timeline) {
    if (!timeline.levelHistory.length) {
      console.log("Already at Root Overview. Nowhere to go.");
      return;
    }

    // Scenario A: We are in the FOCUS state (Div is visible)
    // Action: Zoom out to the full parent view
    if (timeline.viewState === "FOCUS") {
      const snapshot = timeline.levelHistory.pop();

      timeline.camera.setTarget(
        snapshot.cameraTarget.min,
        snapshot.cameraTarget.max,
      );
      timeline.viewState = "OVERVIEW";

      timeline.onBlur?.();
      return;
    }

    // Scenario B: We are deep in a CHILD level
    // Action: Zoom out to the Focus state of the parent segment
    if (
      timeline.viewState === "DEEP" ||
      (timeline.viewState === "OVERVIEW" && timeline.currentLevel > 0)
    ) {
      console.log(
        `Ascending from Level ${timeline.currentLevel} to Parent Focus`,
      );
      const parentSnapshot =
        timeline.levelHistory[timeline.levelHistory.length - 1];
      if (!parentSnapshot) {
        console.log("no parentSnapshot");
        return;
      }

      // RESTORE THE PARENT'S SKIN
      timeline.data = parentSnapshot.data;
      timeline.currentLevel = parentSnapshot.level;

      // We don't pop the history yet, because we are still "inside" tiimeline level's context
      timeline.camera.setTarget(
        parentSnapshot.focusTarget.min,
        parentSnapshot.focusTarget.max,
      );
      timeline.viewState = "FOCUS";

      // Tell main.js to show the UI again
      timeline.onFocusReached?.(parentSnapshot);
    }
  }

  applyEntryEffect(timeline) {
    // Start the view much further than the actual canvas
    const zoomOutFactor = 5;
    timeline.camera.view.min = -this.canvas.width * zoomOutFactor;
    timeline.camera.view.max = this.canvas.width * (zoomOutFactor + 1);
  }
}
