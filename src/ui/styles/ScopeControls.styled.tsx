import styled from "styled-components";
import { COLORS, FONT, Z_INDEX, TRANSITION } from "./theme";

export const CanvasContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background: ${COLORS.background};
`;

export const ToggleBar = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 8px;
  background: ${COLORS.panelBg};
  padding: 8px 12px;
  border: 1px solid ${COLORS.panelBorder};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeXs};
  color: ${COLORS.phosphorGreen};
  border-radius: 4px;
  z-index: ${Z_INDEX.overlay};
`;

export const ModeButton = styled.button<{ active?: boolean }>`
  background: ${({ active }) =>
    active ? COLORS.phosphorGreen : "transparent"};
  color: ${({ active }) => (active ? COLORS.background : COLORS.phosphorGreen)};
  border: 1px solid ${COLORS.phosphorGreen};
  padding: 4px 8px;
  cursor: pointer;
  font-size: ${FONT.sizeXs};
  line-height: 1;
  border-radius: 3px;
  transition: background ${TRANSITION.fast};
  &:hover {
    background: ${COLORS.phosphorGreen};
    color: ${COLORS.background};
  }
`;
