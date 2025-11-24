import styled from "styled-components";
import { COLORS, FONT, Z_INDEX } from "./theme";

export const TimelineContainer = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 80px;
  background: ${COLORS.panelBg};
  border: 1px solid ${COLORS.panelBorder};
  border-radius: 4px;
  z-index: ${Z_INDEX.overlay};
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  backdrop-filter: blur(4px);
  transition: opacity 0.3s ease;
`;

export const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  cursor: pointer;
  border-radius: 3px;
`;

export const Playhead = styled.div<{ left: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${(props) => props.left}%;
  width: 2px;
  background-color: #ff0000;
  pointer-events: none;
  box-shadow: 0 0 4px #ff0000;
  transition: left 0.1s linear;
`;

export const TimeLabel = styled.div`
  position: absolute;
  top: -20px;
  right: 0;
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeXs};
  text-shadow: 0 0 2px ${COLORS.phosphorGreen};
`;

export const EmptyState = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: 14px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
    background: rgba(0, 255, 0, 0.05);
  }
`;

export const HiddenInput = styled.input`
  display: none;
`;

export const ControlsContainer = styled.div`
  position: absolute;
  top: -35px;
  left: 0;
  display: flex;
  gap: 10px;
`;

export const ControlButton = styled.button`
  background: ${COLORS.panelBg};
  border: 1px solid ${COLORS.panelBorder};
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: 12px;
  padding: 4px 12px;
  cursor: pointer;
  text-transform: uppercase;
  border-radius: 2px;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 255, 0, 0.1);
    box-shadow: 0 0 5px ${COLORS.phosphorGreen};
  }

  &:active {
    background: rgba(0, 255, 0, 0.2);
  }
`;
