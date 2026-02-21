import { addons } from "storybook/manager-api";

addons.setConfig({
  initialActive: "canvas",
  sidebar: {
    showRoots: false,
  },
  initialStoryId: "widgets-entitycontext--workspace",
});
