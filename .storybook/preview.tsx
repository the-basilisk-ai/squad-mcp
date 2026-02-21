import type { Preview } from "@storybook/react-vite";
import "../resources/view-strategy-context/styles.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#fafafa" },
        { name: "dark", value: "#09090b" },
      ],
    },
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 420, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
