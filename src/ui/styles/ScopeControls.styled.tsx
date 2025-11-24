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

export const AnalysisOverlay = styled.div`
  position: absolute;
  bottom: 80px; /* Above timeline */
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 20, 0, 0.9);
  border: 1px solid ${COLORS.phosphorGreen};
  padding: 15px;
  border-radius: 8px;
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeSm};
  max-width: 600px;
  text-align: center;
  z-index: ${Z_INDEX.overlay};
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
  pointer-events: none;
  white-space: pre-wrap;
`;

export const ModalOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: ${Z_INDEX.modal};
  backdrop-filter: blur(4px);
`;

export const ModalContent = styled.div`
  background: ${COLORS.panelBg};
  border: 1px solid ${COLORS.phosphorGreen};
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 0 30px rgba(0, 255, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const ModalTitle = styled.h3`
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeMd};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
`;

export const TextArea = styled.textarea`
  background: rgba(0, 20, 0, 0.5);
  border: 1px solid ${COLORS.panelBorder};
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeSm};
  padding: 12px;
  border-radius: 4px;
  resize: vertical;
  min-height: 100px;
  outline: none;
  &:focus {
    border-color: ${COLORS.phosphorGreen};
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.1);
  }
  &::placeholder {
    color: rgba(0, 255, 0, 0.3);
  }
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

export const Button = styled.button<{ variant?: "primary" | "secondary" }>`
  background: ${({ variant }) =>
    variant === "primary" ? "rgba(0, 255, 0, 0.1)" : "transparent"};
  color: ${COLORS.phosphorGreen};
  border: 1px solid
    ${({ variant }) =>
      variant === "primary" ? COLORS.phosphorGreen : COLORS.panelBorder};
  padding: 8px 16px;
  font-family: ${FONT.family};
  font-size: ${FONT.sizeSm};
  cursor: pointer;
  border-radius: 4px;
  text-transform: uppercase;
  transition: all ${TRANSITION.fast};

  &:hover {
    background: ${({ variant }) =>
      variant === "primary" ? COLORS.phosphorGreen : "rgba(0, 255, 0, 0.05)"};
    color: ${({ variant }) =>
      variant === "primary" ? COLORS.background : COLORS.phosphorGreen};
    box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
  }
`;

export const LoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: ${COLORS.phosphorGreen};
  font-family: ${FONT.family};
  font-size: ${FONT.sizeMd};
  text-transform: uppercase;
  letter-spacing: 2px;
`;

export const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 255, 0, 0.1);
  border-top: 3px solid ${COLORS.phosphorGreen};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
