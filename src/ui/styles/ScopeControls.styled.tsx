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

export const ParamsPanel = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: ${COLORS.panelBg};
  padding: 10px 14px;
  border: 1px solid ${COLORS.panelBorder};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeXs};
  color: ${COLORS.phosphorGreen};
  border-radius: 4px;
  min-width: 190px;
  z-index: ${Z_INDEX.overlay};
`;

export const LabelRow = styled.label`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const Inline = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  accent-color: ${COLORS.phosphorGreen};
  cursor: pointer;
`;

export const Range = styled.input.attrs({ type: 'range' })`
  width: 100%;
  cursor: pointer;
  accent-color: ${COLORS.phosphorGreen};
`;

export const ValueBadge = styled.span`
  padding: 2px 6px;
  border: 1px solid ${COLORS.panelBorder};
  border-radius: 3px;
  background: rgba(0,255,0,0.1);
  font-variant-numeric: tabular-nums;
`;
